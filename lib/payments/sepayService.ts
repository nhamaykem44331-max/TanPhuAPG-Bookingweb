/**
 * SePay service — tận dụng PaymentIntent + BankTransaction (provider=SEPAY).
 *
 * Mức A: chỉ QR động (qr.sepay.vn) + webhook biến động số dư.
 * Webhook không kèm `paymentLinkId` từ provider → match qua `providerOrderCode`
 * trích từ `content` của giao dịch (regex "APG<orderCode>").
 */

import {
  BankTransactionStatus,
  BookingStatus,
  PaymentIntentProvider,
  PaymentIntentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type BankTransaction,
  type Payment,
  type PaymentIntent,
} from "@prisma/client";

import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { settleBookingIfFullyPaid } from "@/lib/booking/paidTransition";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import {
  cancelPendingPaymentReminderJobs,
  scheduleHoldPaymentReminderJobs,
} from "@/lib/notifications/jobs";
import {
  assertSepayConfigured,
  buildSepayDedupeKey,
  buildSepayQrUrl,
  extractOrderCodeFromContent,
  parseSepayAmount,
  parseSepayTransactionDate,
  type SepayWebhookPayload,
} from "@/lib/payments/providers/sepay";
import { classifyPaymentAmount } from "@/lib/payments/reconciliation";
import {
  canCancelPaymentIntent,
  getEffectivePaymentIntentStatus,
  isReusablePaymentIntent,
  sortPaymentIntentsNewestFirst,
} from "@/lib/payments/paymentIntentLifecycle";

export class SepayError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SepayError";
    this.status = status;
    this.code = code;
  }
}

export interface CreateSepayIntentResult {
  intent: PaymentIntent;
  reused: boolean;
}

export interface SepayWebhookResult {
  kind: "matched" | "manual_review" | "duplicate" | "ignored";
  bankTransaction?: BankTransaction;
  payment?: Payment | null;
  paymentIntent?: PaymentIntent | null;
  reason?: string;
  bookingId?: string | null;
  orderCode?: string | null;
  pnr?: string | null;
  transferredAmount?: number | null;
  remainingAmount?: number | null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizePnrCode(value: string | null | undefined): string | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized || normalized.startsWith("PENDING")) {
    return null;
  }

  return normalized;
}

function uniquePnrCodes(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizePnrCode(value);

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function buildSepayDescription(orderCode: string, pnrCodes: string[] = []): string {
  const base = `APG${orderCode}`;
  const parts = [base];

  for (const pnr of pnrCodes) {
    const candidate = [...parts, pnr].join(" ");

    // Bank transfer descriptions are often truncated by banking apps.
    // Keep APG<code> first for matching, then include as many PNRs as fit.
    if (candidate.length > 70) {
      break;
    }

    parts.push(pnr);
  }

  return parts.join(" ");
}

function mapIntentStatus(decision: "PAID" | "PARTIAL" | "MANUAL_REVIEW"): PaymentIntentStatus {
  if (decision === "PAID") return PaymentIntentStatus.PAID;
  if (decision === "PARTIAL") return PaymentIntentStatus.PARTIAL;
  return PaymentIntentStatus.MANUAL_REVIEW;
}

async function generateProviderOrderCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const orderCode = `${Math.floor(Date.now() / 1000)}${randomSuffix}`;
    const existing = await prisma.paymentIntent.findUnique({
      where: { providerOrderCode: orderCode },
      select: { id: true },
    });

    if (!existing) {
      return orderCode;
    }
  }

  throw new SepayError(500, "ORDER_CODE_GENERATION_FAILED", "Không tạo được orderCode SePay duy nhất.");
}

function ensureSepayConfigured(): void {
  try {
    assertSepayConfigured();
  } catch (error) {
    throw new SepayError(503, "SEPAY_NOT_CONFIGURED", error instanceof Error ? error.message : "SePay chưa được cấu hình.");
  }
}

function assertPayableBookingStatus(status: string): void {
  if (status !== "HELD" && status !== "TICKETED") {
    throw new SepayError(409, "INVALID_STATUS", `Booking đang ở trạng thái ${status}, không thể tạo QR thanh toán.`);
  }
}

async function expireStalePaymentIntentsTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<PaymentIntent[]> {
  const stale = await tx.paymentIntent.findMany({
    where: {
      bookingId,
      provider: PaymentIntentProvider.SEPAY,
      status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] },
      expiresAt: { lte: new Date() },
    },
  });

  const expired: PaymentIntent[] = [];

  for (const intent of stale) {
    const updated = await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentIntentStatus.EXPIRED },
    });

    await tx.bookingTimelineEvent.create({
      data: {
        bookingId,
        source: "sepay",
        eventType: "PAYMENT_INTENT_EXPIRED",
        title: "QR SePay hết hiệu lực",
        payload: toJsonValue({
          paymentIntentId: intent.id,
          providerOrderCode: intent.providerOrderCode,
        }),
        occurredAt: new Date(),
      },
    });

    await audit(tx, {
      actorId: null,
      entity: "PaymentIntent",
      entityId: intent.id,
      action: "payment_intent.expire",
      diff: buildAuditDiff({ status: intent.status }, { status: updated.status }),
    });

    await cancelPendingPaymentReminderJobs(tx, {
      bookingId,
      paymentIntentId: intent.id,
    });

    expired.push(updated);
  }

  return expired;
}

export async function syncExpiredSepayIntentsForBooking(bookingId: string): Promise<PaymentIntent[]> {
  return prisma.$transaction((tx) => expireStalePaymentIntentsTx(tx, bookingId));
}

export async function createSepayIntentForBooking(
  bookingId: string,
  actorId: string | null,
): Promise<CreateSepayIntentResult> {
  ensureSepayConfigured();
  await syncBookingOrderById(bookingId);
  await syncExpiredSepayIntentsForBooking(bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      pnrs: {
        orderBy: { createdAt: "asc" },
        select: { pnr: true },
      },
      payments: { select: { amount: true, status: true } },
      paymentIntents: {
        where: {
          provider: PaymentIntentProvider.SEPAY,
          status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!booking) {
    throw new SepayError(404, "BOOKING_NOT_FOUND", "Không tìm thấy booking.");
  }

  assertPayableBookingStatus(booking.status);

  if (booking.ttlExpiresAt && booking.ttlExpiresAt.getTime() <= Date.now()) {
    throw new SepayError(409, "BOOKING_EXPIRED", "Booking đã hết hạn giữ chỗ, không thể tạo QR thanh toán.");
  }

  const summary = calculatePaymentSummary(booking.payments, booking.saleAmount);
  const pnrCodes = uniquePnrCodes([booking.pnr, ...booking.pnrs.map((pnr) => pnr.pnr)]);

  if (summary.balance <= 0) {
    throw new SepayError(422, "NO_BALANCE_DUE", "Booking đã đủ tiền, không cần tạo QR thanh toán.");
  }

  const active = sortPaymentIntentsNewestFirst(booking.paymentIntents);
  const reusable = active.find((intent) => isReusablePaymentIntent(intent, summary.balance));

  if (reusable) {
    const expectedDescription = buildSepayDescription(reusable.providerOrderCode, pnrCodes);

    if (reusable.transferContent !== expectedDescription) {
      const qr = buildSepayQrUrl({
        transferContent: expectedDescription,
        amount: reusable.amount,
      });
      const updatedReusable = await prisma.paymentIntent.update({
        where: { id: reusable.id },
        data: {
          description: expectedDescription,
          transferContent: expectedDescription,
          qrCode: qr.qrUrl,
          accountNumber: qr.accountNumber,
          accountName: qr.accountName,
          bin: qr.bankCode,
        },
      });

      return { intent: updatedReusable, reused: true };
    }

    return { intent: reusable, reused: true };
  }

  const blocking = active.find((intent) => getEffectivePaymentIntentStatus(intent) !== PaymentIntentStatus.EXPIRED);

  if (blocking) {
    throw new SepayError(
      409,
      "ACTIVE_PAYMENT_INTENT_EXISTS",
      "Đã có QR SePay còn hiệu lực cho booking này. Vui lòng hủy QR hiện tại trước khi tạo mã mới.",
    );
  }

  const providerOrderCode = await generateProviderOrderCode();
  const description = buildSepayDescription(providerOrderCode, pnrCodes);
  const expiresAt = booking.ttlExpiresAt ?? null;

  const qr = buildSepayQrUrl({
    transferContent: description,
    amount: summary.balance,
  });

  const intent = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentIntent.create({
      data: {
        bookingId: booking.id,
        provider: PaymentIntentProvider.SEPAY,
        providerOrderCode,
        amount: summary.balance,
        currency: booking.currency,
        description,
        transferContent: description,
        qrCode: qr.qrUrl,
        accountNumber: qr.accountNumber,
        accountName: qr.accountName,
        bin: qr.bankCode, // Lưu bank code vào field bin (giống PayOS) để không phải đổi schema
        expiresAt,
        createdById: actorId,
        status: PaymentIntentStatus.PENDING,
        rawJson: toJsonValue({
          qrTemplate: process.env.SEPAY_QR_TEMPLATE || "compact",
          orderCode: booking.orderCode,
          pnrs: pnrCodes,
          transferContentVersion: 2,
        }),
      },
    });

    await audit(tx, {
      actorId,
      entity: "PaymentIntent",
      entityId: created.id,
      action: "payment_intent.create",
      diff: buildAuditDiff(null, {
        id: created.id,
        bookingId: created.bookingId,
        provider: created.provider,
        providerOrderCode: created.providerOrderCode,
        amount: created.amount,
        status: created.status,
      }),
    });

    await scheduleHoldPaymentReminderJobs(tx, {
      bookingId: booking.id,
      customerId: booking.customerId,
      paymentIntentId: created.id,
      ttlExpiresAt: booking.ttlExpiresAt,
      payload: {
        bookingId: booking.id,
        paymentIntentId: created.id,
        amount: created.amount,
        currency: created.currency,
        qrCode: created.qrCode,
        provider: "sepay",
      },
    });

    return created;
  });

  return { intent, reused: false };
}

export async function cancelSepayIntent(
  bookingId: string,
  intentId: string,
  actorId: string,
): Promise<{ intent: PaymentIntent; outcome: "cancelled" | "expired" }> {
  await syncBookingOrderById(bookingId);
  await syncExpiredSepayIntentsForBooking(bookingId);

  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, bookingId, provider: PaymentIntentProvider.SEPAY },
    include: { booking: { select: { pnr: true } } },
  });

  if (!intent) {
    throw new SepayError(404, "PAYMENT_INTENT_NOT_FOUND", "Không tìm thấy QR SePay.");
  }

  const effective = getEffectivePaymentIntentStatus(intent);

  if (effective === PaymentIntentStatus.EXPIRED) {
    const expired = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    return { intent: expired, outcome: "expired" };
  }

  if (!canCancelPaymentIntent(intent)) {
    throw new SepayError(409, "PAYMENT_INTENT_NOT_CANCELLABLE", `QR đang ở trạng thái ${effective}, không thể hủy.`);
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentIntentStatus.CANCELLED },
    });

    await tx.bookingTimelineEvent.create({
      data: {
        bookingId: intent.bookingId,
        pnr: intent.booking.pnr ?? null,
        source: "sepay",
        eventType: "PAYMENT_INTENT_CANCELLED",
        title: "QR SePay đã bị hủy",
        payload: toJsonValue({
          paymentIntentId: intent.id,
          providerOrderCode: intent.providerOrderCode,
          reason: "ADMIN_CANCELLED",
        }),
        occurredAt: new Date(),
      },
    });

    await audit(tx, {
      actorId,
      entity: "PaymentIntent",
      entityId: intent.id,
      action: "payment_intent.cancel",
      diff: buildAuditDiff({ status: intent.status }, { status: updated.status }),
    });

    await cancelPendingPaymentReminderJobs(tx, {
      bookingId: intent.bookingId,
      paymentIntentId: intent.id,
    });

    return updated;
  });

  return { intent: cancelled, outcome: "cancelled" };
}

function bankTransactionDataFromWebhook(payload: SepayWebhookPayload, amount: number) {
  return {
    provider: PaymentIntentProvider.SEPAY,
    providerOrderCode: extractOrderCodeFromContent(payload.content),
    paymentLinkId: null,
    reference: payload.referenceCode || payload.code || null,
    amount,
    currency: "VND",
    description: payload.content,
    accountNumber: payload.accountNumber,
    transactionDateTime: parseSepayTransactionDate(payload.transactionDate),
    counterAccountBankId: null,
    counterAccountBankName: payload.gateway,
    counterAccountName: null,
    counterAccountNumber: null,
    virtualAccountName: null,
    virtualAccountNumber: payload.subAccount,
    rawJson: toJsonValue(payload),
  };
}

/**
 * Xử lý webhook biến động số dư từ SePay.
 * - Idempotency: theo `id` giao dịch (encode trong dedupeKey)
 * - Match: providerOrderCode trích từ `content` ↔ PaymentIntent (provider=SEPAY)
 * - Reject: transferType ≠ "in", booking expired, intent đã PAID
 * - Manual review: amount mismatch, không tìm thấy intent
 */
export async function handleSepayWebhook(payload: SepayWebhookPayload): Promise<SepayWebhookResult> {
  const amount = parseSepayAmount(payload.transferAmount);
  const dedupeKey = buildSepayDedupeKey({ id: payload.id, transferAmount: amount });
  const orderCodeFromContent = extractOrderCodeFromContent(payload.content);

  // Sync booking order trước (cập nhật ttl, status mới nhất)
  if (orderCodeFromContent) {
    const matchIntent = await prisma.paymentIntent.findFirst({
      where: {
        provider: PaymentIntentProvider.SEPAY,
        providerOrderCode: orderCodeFromContent,
      },
      select: { bookingId: true },
    });

    if (matchIntent?.bookingId) {
      await syncBookingOrderById(matchIntent.bookingId);
    }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Chống trùng
    const existing = await tx.bankTransaction.findUnique({
      where: { dedupeKey },
      include: { paymentIntent: true, payment: true },
    });

    if (existing) {
      const orderCode = existing.paymentIntent?.bookingId
        ? (await tx.booking.findUnique({
            where: { id: existing.paymentIntent.bookingId },
            select: { orderCode: true },
          }))?.orderCode ?? null
        : null;

      return {
        kind: "duplicate" as const,
        bankTransaction: existing,
        payment: existing.payment,
        paymentIntent: existing.paymentIntent,
        reason: "DUPLICATE_WEBHOOK",
        bookingId: existing.paymentIntent?.bookingId ?? null,
        orderCode,
        transferredAmount: existing.amount,
      };
    }

    // 2. Bỏ qua giao dịch tiền ra
    if (payload.transferType !== "in") {
      const bankTxn = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          status: BankTransactionStatus.IGNORED,
          manualReviewReason: "SEPAY_NOT_INCOMING",
          ...bankTransactionDataFromWebhook(payload, amount),
        },
      });

      return {
        kind: "ignored" as const,
        bankTransaction: bankTxn,
        reason: "SEPAY_NOT_INCOMING",
        transferredAmount: amount,
      };
    }

    // 3. Tìm PaymentIntent theo providerOrderCode trích từ content
    const intent = orderCodeFromContent
      ? await tx.paymentIntent.findFirst({
          where: {
            provider: PaymentIntentProvider.SEPAY,
            providerOrderCode: orderCodeFromContent,
          },
          include: {
            payments: { select: { amount: true, status: true } },
            booking: {
              select: {
                id: true,
                orderCode: true,
                pnr: true,
                saleAmount: true,
                currency: true,
                status: true,
                ttlExpiresAt: true,
              },
            },
          },
        })
      : null;

    // 4. Không match được intent → manual review
    if (!intent) {
      const bankTxn = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: orderCodeFromContent
            ? "PAYMENT_INTENT_NOT_FOUND"
            : "ORDER_CODE_MISSING_IN_CONTENT",
          ...bankTransactionDataFromWebhook(payload, amount),
        },
      });

      return {
        kind: "manual_review" as const,
        bankTransaction: bankTxn,
        reason: orderCodeFromContent ? "PAYMENT_INTENT_NOT_FOUND" : "ORDER_CODE_MISSING_IN_CONTENT",
        transferredAmount: amount,
      };
    }

    // 5. Booking đã hết hạn
    if (
      intent.booking.status === BookingStatus.EXPIRED ||
      (intent.booking.ttlExpiresAt && intent.booking.ttlExpiresAt.getTime() <= Date.now())
    ) {
      const bankTxn = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: "ORDER_EXPIRED",
          ...bankTransactionDataFromWebhook(payload, amount),
        },
      });

      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.EXPIRED },
      });

      await cancelPendingPaymentReminderJobs(tx, {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
      });

      return {
        kind: "manual_review" as const,
        bankTransaction: bankTxn,
        paymentIntent: intent,
        reason: "ORDER_EXPIRED",
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: amount,
      };
    }

    // 6. Intent đã đủ tiền
    const paidSoFar = intent.payments.reduce((sum, p) => {
      if (p.status === PaymentStatus.PAID || p.status === PaymentStatus.PARTIAL) {
        return sum + p.amount;
      }
      return sum;
    }, 0);
    const remaining = Math.max(intent.amount - paidSoFar, 0);

    if (remaining <= 0) {
      const bankTxn = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: "PAYMENT_INTENT_ALREADY_PAID",
          ...bankTransactionDataFromWebhook(payload, amount),
        },
      });

      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.MANUAL_REVIEW },
      });
      await cancelPendingPaymentReminderJobs(tx, {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
      });

      return {
        kind: "manual_review" as const,
        bankTransaction: bankTxn,
        paymentIntent: intent,
        reason: "PAYMENT_INTENT_ALREADY_PAID",
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: amount,
      };
    }

    // 7. Phân loại số tiền (PAID / PARTIAL / MANUAL_REVIEW)
    const decision = classifyPaymentAmount({
      expectedAmount: remaining,
      transferredAmount: amount,
    });

    if (decision.decision === "MANUAL_REVIEW") {
      const updatedIntent = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.MANUAL_REVIEW },
      });
      const bankTxn = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: decision.reason,
          ...bankTransactionDataFromWebhook(payload, amount),
        },
      });

      await audit(tx, {
        actorId: null,
        entity: "PaymentIntent",
        entityId: intent.id,
        action: "payment_intent.manual_review",
        diff: buildAuditDiff({ status: intent.status }, { status: updatedIntent.status }),
      });
      await cancelPendingPaymentReminderJobs(tx, {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
      });

      return {
        kind: "manual_review" as const,
        bankTransaction: bankTxn,
        paymentIntent: updatedIntent,
        reason: decision.reason ?? undefined,
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: amount,
        remainingAmount: Math.max(remaining - amount, 0),
      };
    }

    // 8. Match thành công (PAID hoặc PARTIAL)
    const paidAt = parseSepayTransactionDate(payload.transactionDate) ?? new Date();
    const paymentStatus = decision.decision === "PAID" ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    const intentStatus = mapIntentStatus(decision.decision);

    const payment = await tx.payment.create({
      data: {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
        method: PaymentMethod.QR,
        amount,
        currency: intent.currency,
        status: paymentStatus,
        paidAt,
        transactionRef: payload.referenceCode || payload.code || String(payload.id),
        reconciledAt: new Date(),
        notes: `SePay webhook ${payload.gateway} #${payload.id}`,
      },
    });

    const bankTxn = await tx.bankTransaction.create({
      data: {
        dedupeKey,
        paymentIntentId: intent.id,
        paymentId: payment.id,
        status: BankTransactionStatus.MATCHED,
        ...bankTransactionDataFromWebhook(payload, amount),
      },
    });

    const updatedIntent = await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: intentStatus,
        paidAt: intentStatus === PaymentIntentStatus.PAID ? paidAt : intent.paidAt,
      },
    });

    await tx.bookingTimelineEvent.create({
      data: {
        bookingId: intent.bookingId,
        pnr: intent.booking.pnr,
        source: "sepay",
        eventType: "PAYMENT_AUTO_MATCHED",
        title: "Tự động đối soát thanh toán SePay",
        payload: toJsonValue({
          paymentId: payment.id,
          paymentIntentId: intent.id,
          bankTransactionId: bankTxn.id,
          amount: payment.amount,
          status: payment.status,
          gateway: payload.gateway,
          sepayId: payload.id,
        }),
        occurredAt: paidAt,
      },
    });

    await audit(tx, {
      actorId: null,
      entity: "Payment",
      entityId: payment.id,
      action: "payment.auto_matched",
      diff: buildAuditDiff(null, {
        id: payment.id,
        bookingId: payment.bookingId,
        paymentIntentId: payment.paymentIntentId,
        amount: payment.amount,
        status: payment.status,
        transactionRef: payment.transactionRef,
      }),
    });

    await audit(tx, {
      actorId: null,
      entity: "PaymentIntent",
      entityId: intent.id,
      action: "payment_intent.update",
      diff: buildAuditDiff(
        { status: intent.status, paidAt: intent.paidAt?.toISOString() ?? null },
        { status: updatedIntent.status, paidAt: updatedIntent.paidAt?.toISOString() ?? null },
      ),
    });

    if (
      updatedIntent.status === PaymentIntentStatus.PAID ||
      updatedIntent.status === PaymentIntentStatus.PARTIAL ||
      updatedIntent.status === PaymentIntentStatus.MANUAL_REVIEW
    ) {
      await cancelPendingPaymentReminderJobs(tx, {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
      });
    }

    // B3 (Phần D) — khi booking đã đủ tiền: HELD/PENDING_PAYMENT → PAID, đặt SLA
    // xuất vé và đẩy job NEEDS_TICKETING. Dùng chung helper với luồng thu tay.
    if (decision.decision === "PAID") {
      await settleBookingIfFullyPaid(tx, {
        bookingId: intent.bookingId,
        paidAt,
        source: "system",
      });
    }

    return {
      kind: "matched" as const,
      bankTransaction: bankTxn,
      payment,
      paymentIntent: updatedIntent,
      reason: decision.reason ?? undefined,
      bookingId: intent.booking.id,
      orderCode: intent.booking.orderCode,
      pnr: intent.booking.pnr,
      transferredAmount: amount,
      remainingAmount: Math.max(remaining - amount, 0),
    };
  });
}
