import {
  BankTransactionStatus,
  BookingStatus,
  PaymentIntentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type BankTransaction,
  type Payment,
  type PaymentIntent,
} from "@prisma/client";
import type { Webhook, WebhookData } from "@payos/node";

import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";
import { cancelPendingPaymentReminderJobs, scheduleHoldPaymentReminderJobs } from "@/lib/notifications/jobs";
import {
  assertPayOSConfigured,
  cancelPayOSPaymentLink,
  createPayOSPaymentLink,
  getPayOSCancelUrl,
  getPayOSReturnUrl,
  verifyPayOSWebhook,
} from "@/lib/payments/providers/payos";
import {
  canCancelPaymentIntent,
  getEffectivePaymentIntentStatus,
  isReusablePaymentIntent,
  sortPaymentIntentsNewestFirst,
} from "@/lib/payments/paymentIntentLifecycle";
import {
  buildPayOSDedupeKey,
  buildPayOSDescription,
  classifyPaymentAmount,
  parsePayOSTransactionDateTime,
} from "@/lib/payments/reconciliation";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";

export class PaymentIntentError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PaymentIntentError";
    this.status = status;
    this.code = code;
  }
}

export interface CreatePaymentIntentResult {
  intent: PaymentIntent;
  reused: boolean;
}

export interface CancelPaymentIntentResult {
  intent: PaymentIntent;
  outcome: "cancelled" | "expired";
}

export interface PayOSWebhookResult {
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

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (JSON.parse(JSON.stringify(value)) as Record<string, unknown>) : {};
}

function nowUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function ttlToExpiredAt(ttlExpiresAt: Date | null): number | undefined {
  if (!ttlExpiresAt) {
    return undefined;
  }

  return nowUnixSeconds(ttlExpiresAt);
}

function assertPayableBookingStatus(status: string): void {
  if (status !== "HELD" && status !== "TICKETED") {
    throw new PaymentIntentError(409, "INVALID_STATUS", `Booking đang ở trạng thái ${status}, không thể tạo QR thanh toán.`);
  }
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

  throw new PaymentIntentError(500, "ORDER_CODE_GENERATION_FAILED", "Không tạo được mã orderCode payOS duy nhất.");
}

function mapIntentStatus(decision: "PAID" | "PARTIAL" | "MANUAL_REVIEW"): PaymentIntentStatus {
  if (decision === "PAID") {
    return PaymentIntentStatus.PAID;
  }

  if (decision === "PARTIAL") {
    return PaymentIntentStatus.PARTIAL;
  }

  return PaymentIntentStatus.MANUAL_REVIEW;
}

async function expireStalePaymentIntentsTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<PaymentIntent[]> {
  const staleIntents = await tx.paymentIntent.findMany({
    where: {
      bookingId,
      status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] },
      expiresAt: { lte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (staleIntents.length === 0) {
    return [];
  }

  const expiredIntents: PaymentIntent[] = [];

  for (const intent of staleIntents) {
    const updatedIntent = await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentIntentStatus.EXPIRED },
    });

    await tx.bookingTimelineEvent.create({
      data: {
        bookingId,
        source: "payos",
        eventType: "PAYMENT_INTENT_EXPIRED",
        title: "QR thanh toán hết hiệu lực",
        payload: toJsonValue({
          paymentIntentId: intent.id,
          providerOrderCode: intent.providerOrderCode,
          previousStatus: intent.status,
          expiresAt: intent.expiresAt?.toISOString() ?? null,
        }),
        occurredAt: new Date(),
      },
    });

    await audit(tx, {
      actorId: null,
      entity: "PaymentIntent",
      entityId: intent.id,
      action: "payment_intent.expire",
      diff: buildAuditDiff(
        { status: intent.status },
        { status: updatedIntent.status },
      ),
    });

    await cancelPendingPaymentReminderJobs(tx, {
      bookingId,
      paymentIntentId: intent.id,
    });

    expiredIntents.push(updatedIntent);
  }

  return expiredIntents;
}

async function persistPaymentIntentCancellation(
  tx: Prisma.TransactionClient,
  args: {
    intent: PaymentIntent;
    actorId: string;
    bookingPnr?: string | null;
    reason: string;
    rawResult?: unknown;
  },
): Promise<PaymentIntent> {
  const updatedIntent = await tx.paymentIntent.update({
    where: { id: args.intent.id },
    data: {
      status: PaymentIntentStatus.CANCELLED,
      rawJson: toJsonValue({
        ...toRecord(args.intent.rawJson),
        cancelResult: args.rawResult ?? null,
        cancellationReason: args.reason,
      }),
    },
  });

  await tx.bookingTimelineEvent.create({
    data: {
      bookingId: args.intent.bookingId,
      pnr: args.bookingPnr ?? null,
      source: "payos",
      eventType: "PAYMENT_INTENT_CANCELLED",
      title: "QR thanh toán đã bị hủy",
      payload: toJsonValue({
        paymentIntentId: args.intent.id,
        providerOrderCode: args.intent.providerOrderCode,
        reason: args.reason,
      }),
      occurredAt: new Date(),
    },
  });

  await audit(tx, {
    actorId: args.actorId,
    entity: "PaymentIntent",
    entityId: args.intent.id,
    action: "payment_intent.cancel",
    diff: buildAuditDiff(
      { status: args.intent.status },
      { status: updatedIntent.status },
    ),
  });

  await cancelPendingPaymentReminderJobs(tx, {
    bookingId: args.intent.bookingId,
    paymentIntentId: args.intent.id,
  });

  return updatedIntent;
}

function ensurePayOSConfigured(): void {
  try {
    assertPayOSConfigured();
  } catch (error) {
    throw new PaymentIntentError(503, "PAYOS_NOT_CONFIGURED", error instanceof Error ? error.message : "payOS chưa được cấu hình.");
  }
}

export async function syncExpiredPaymentIntentsForBooking(bookingId: string): Promise<PaymentIntent[]> {
  return prisma.$transaction((tx) => expireStalePaymentIntentsTx(tx, bookingId));
}

export async function createPaymentIntentForBooking(
  bookingId: string,
  actorId: string | null,
): Promise<CreatePaymentIntentResult> {
  ensurePayOSConfigured();
  await syncBookingOrderById(bookingId);
  await syncExpiredPaymentIntentsForBooking(bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      payments: {
        select: {
          amount: true,
          status: true,
        },
      },
      paymentIntents: {
        where: {
          status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!booking) {
    throw new PaymentIntentError(404, "BOOKING_NOT_FOUND", "Không tìm thấy booking.");
  }

  assertPayableBookingStatus(booking.status);

  if (booking.ttlExpiresAt && booking.ttlExpiresAt.getTime() <= Date.now()) {
    throw new PaymentIntentError(409, "BOOKING_EXPIRED", "Booking đã hết hạn giữ chỗ, không thể tạo QR thanh toán.");
  }

  const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);

  if (paymentSummary.balance <= 0) {
    throw new PaymentIntentError(422, "NO_BALANCE_DUE", "Booking đã đủ tiền, không cần tạo QR thanh toán.");
  }

  const activeIntents = sortPaymentIntentsNewestFirst(booking.paymentIntents);
  const reusableIntent = activeIntents.find((intent) => isReusablePaymentIntent(intent, paymentSummary.balance));

  if (reusableIntent) {
    return { intent: reusableIntent, reused: true };
  }

  const blockingIntent = activeIntents.find((intent) => getEffectivePaymentIntentStatus(intent) !== PaymentIntentStatus.EXPIRED);

  if (blockingIntent) {
    throw new PaymentIntentError(
      409,
      "ACTIVE_PAYMENT_INTENT_EXISTS",
      "Đã có QR payOS còn hiệu lực cho booking này. Vui lòng hủy QR hiện tại trước khi tạo mã mới.",
    );
  }

  const orderCode = await generateProviderOrderCode();
  const description = buildPayOSDescription(orderCode);
  const expiresAt = booking.ttlExpiresAt ?? null;

  const localIntent = await prisma.paymentIntent.create({
    data: {
      bookingId: booking.id,
      providerOrderCode: orderCode,
      amount: paymentSummary.balance,
      currency: booking.currency,
      description,
      transferContent: description,
      expiresAt,
      createdById: actorId,
    },
  });

  try {
    const paymentLink = await createPayOSPaymentLink({
      orderCode: Number(orderCode),
      amount: paymentSummary.balance,
      description,
      returnUrl: getPayOSReturnUrl(booking.id),
      cancelUrl: getPayOSCancelUrl(booking.id),
      buyerName: booking.customer?.fullName,
      buyerEmail: booking.customer?.email,
      buyerPhone: booking.customer?.phone,
      expiredAt: ttlToExpiredAt(expiresAt),
    });

    const intent = await prisma.$transaction(async (tx) => {
      const updatedIntent = await tx.paymentIntent.update({
        where: { id: localIntent.id },
        data: {
          paymentLinkId: paymentLink.paymentLinkId,
          checkoutUrl: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
          accountNumber: paymentLink.accountNumber,
          accountName: paymentLink.accountName,
          bin: paymentLink.bin,
          status: paymentLink.status === "PAID" ? PaymentIntentStatus.PAID : PaymentIntentStatus.PENDING,
          rawJson: toJsonValue(paymentLink),
        },
      });

      await audit(tx, {
        actorId,
        entity: "PaymentIntent",
        entityId: updatedIntent.id,
        action: "payment_intent.create",
        diff: buildAuditDiff(null, {
          id: updatedIntent.id,
          bookingId: updatedIntent.bookingId,
          provider: updatedIntent.provider,
          providerOrderCode: updatedIntent.providerOrderCode,
          paymentLinkId: updatedIntent.paymentLinkId,
          amount: updatedIntent.amount,
          status: updatedIntent.status,
        }),
      });

      await scheduleHoldPaymentReminderJobs(tx, {
        bookingId: booking.id,
        customerId: booking.customerId,
        paymentIntentId: updatedIntent.id,
        ttlExpiresAt: booking.ttlExpiresAt,
        payload: {
          bookingId: booking.id,
          paymentIntentId: updatedIntent.id,
          amount: updatedIntent.amount,
          currency: updatedIntent.currency,
          checkoutUrl: updatedIntent.checkoutUrl,
        },
      });

      return updatedIntent;
    });

    return { intent, reused: false };
  } catch (error) {
    await prisma.paymentIntent.update({
      where: { id: localIntent.id },
      data: {
        status: PaymentIntentStatus.FAILED,
        rawJson: toJsonValue({
          error: error instanceof Error ? error.message : String(error),
        }),
      },
    });

    throw error;
  }
}

export async function cancelPaymentIntentForBooking(
  bookingId: string,
  intentId: string,
  actorId: string,
): Promise<CancelPaymentIntentResult> {
  ensurePayOSConfigured();
  await syncBookingOrderById(bookingId);
  await syncExpiredPaymentIntentsForBooking(bookingId);

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: intentId,
      bookingId,
    },
    include: {
      booking: {
        select: {
          pnr: true,
        },
      },
    },
  });

  if (!intent) {
    throw new PaymentIntentError(404, "PAYMENT_INTENT_NOT_FOUND", "Không tìm thấy QR thanh toán.");
  }

  const effectiveStatus = getEffectivePaymentIntentStatus(intent);

  if (effectiveStatus === PaymentIntentStatus.EXPIRED) {
    const expiredIntent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    return { intent: expiredIntent, outcome: "expired" };
  }

  if (!canCancelPaymentIntent(intent)) {
    throw new PaymentIntentError(409, "PAYMENT_INTENT_NOT_CANCELLABLE", `QR đang ở trạng thái ${effectiveStatus}, không thể hủy.`);
  }

  const providerTarget = intent.paymentLinkId || Number(intent.providerOrderCode);
  const cancelResult = await cancelPayOSPaymentLink(providerTarget, "Admin cancelled QR payment");
  const cancelledIntent = await prisma.$transaction((tx) =>
    persistPaymentIntentCancellation(tx, {
      intent,
      actorId,
      bookingPnr: intent.booking.pnr,
      reason: "ADMIN_CANCELLED",
      rawResult: cancelResult,
    }),
  );

  return { intent: cancelledIntent, outcome: "cancelled" };
}

function buildWebhookRawJson(webhook: Webhook): Prisma.InputJsonValue {
  return toJsonValue(webhook);
}

function bankTransactionDataFromWebhook(webhook: Webhook, data: WebhookData) {
  return {
    providerOrderCode: data.orderCode.toString(),
    paymentLinkId: data.paymentLinkId,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency || "VND",
    description: data.description,
    accountNumber: data.accountNumber,
    transactionDateTime: parsePayOSTransactionDateTime(data.transactionDateTime),
    counterAccountBankId: data.counterAccountBankId,
    counterAccountBankName: data.counterAccountBankName,
    counterAccountName: data.counterAccountName,
    counterAccountNumber: data.counterAccountNumber,
    virtualAccountName: data.virtualAccountName,
    virtualAccountNumber: data.virtualAccountNumber,
    rawJson: buildWebhookRawJson(webhook),
  };
}

export async function handlePayOSWebhook(webhook: Webhook): Promise<PayOSWebhookResult> {
  const data = await verifyPayOSWebhook(webhook);
  const dedupeKey = buildPayOSDedupeKey({
    reference: data.reference,
    paymentLinkId: data.paymentLinkId,
    orderCode: data.orderCode,
    amount: data.amount,
  });
  const syncTargetIntent = await prisma.paymentIntent.findFirst({
    where: {
      OR: [
        { providerOrderCode: data.orderCode.toString() },
        ...(data.paymentLinkId ? [{ paymentLinkId: data.paymentLinkId }] : []),
      ],
    },
    select: {
      bookingId: true,
    },
  });

  if (syncTargetIntent?.bookingId) {
    await syncBookingOrderById(syncTargetIntent.bookingId);
  }

  return prisma.$transaction(async (tx) => {
    const existingTransaction = await tx.bankTransaction.findUnique({
      where: { dedupeKey },
      include: {
        paymentIntent: true,
        payment: true,
      },
    });

    if (existingTransaction) {
      return {
        kind: "duplicate" as const,
        bankTransaction: existingTransaction,
        payment: existingTransaction.payment,
        paymentIntent: existingTransaction.paymentIntent,
        reason: "DUPLICATE_WEBHOOK",
        bookingId: existingTransaction.paymentIntent?.bookingId ?? null,
        orderCode: existingTransaction.paymentIntent?.bookingId
          ? (
              await tx.booking.findUnique({
                where: { id: existingTransaction.paymentIntent.bookingId },
                select: { orderCode: true },
              })
            )?.orderCode ?? null
          : null,
        transferredAmount: existingTransaction.amount,
      };
    }

    const intent = await tx.paymentIntent.findFirst({
      where: {
        OR: [
          { providerOrderCode: data.orderCode.toString() },
          ...(data.paymentLinkId ? [{ paymentLinkId: data.paymentLinkId }] : []),
        ],
      },
      include: {
        payments: {
          select: { amount: true, status: true },
        },
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
    });

    if (!webhook.success || data.code !== "00") {
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent?.id,
          status: BankTransactionStatus.IGNORED,
          manualReviewReason: `PAYOS_${data.code || "FAILED"}`,
          ...bankTransactionDataFromWebhook(webhook, data),
        },
      });

      return {
        kind: "ignored" as const,
        bankTransaction,
        paymentIntent: intent,
        reason: `PAYOS_${data.code || "FAILED"}`,
        bookingId: intent?.booking.id ?? null,
        orderCode: intent?.booking.orderCode ?? null,
        pnr: intent?.booking.pnr ?? null,
        transferredAmount: data.amount,
      };
    }

    if (!intent) {
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: "PAYMENT_INTENT_NOT_FOUND",
          ...bankTransactionDataFromWebhook(webhook, data),
        },
      });

      return {
        kind: "manual_review" as const,
        bankTransaction,
        paymentIntent: null,
        reason: "PAYMENT_INTENT_NOT_FOUND",
        transferredAmount: data.amount,
      };
    }

    if (
      intent.booking.status === BookingStatus.EXPIRED ||
      (intent.booking.ttlExpiresAt && intent.booking.ttlExpiresAt.getTime() <= Date.now())
    ) {
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: "ORDER_EXPIRED",
          ...bankTransactionDataFromWebhook(webhook, data),
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
        bankTransaction,
        paymentIntent: intent,
        reason: "ORDER_EXPIRED",
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: data.amount,
      };
    }

    const existingPaidAmount = intent.payments.reduce((sum, payment) => {
      if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL) {
        return sum + payment.amount;
      }

      return sum;
    }, 0);
    const remainingIntentAmount = Math.max(intent.amount - existingPaidAmount, 0);

    if (remainingIntentAmount <= 0) {
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: "PAYMENT_INTENT_ALREADY_PAID",
          ...bankTransactionDataFromWebhook(webhook, data),
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
        bankTransaction,
        paymentIntent: intent,
        reason: "PAYMENT_INTENT_ALREADY_PAID",
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: data.amount,
      };
    }

    const amountDecision = classifyPaymentAmount({
      expectedAmount: remainingIntentAmount,
      transferredAmount: data.amount,
    });

    if (amountDecision.decision === "MANUAL_REVIEW") {
      const updatedIntent = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.MANUAL_REVIEW },
      });
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          dedupeKey,
          paymentIntentId: intent.id,
          status: BankTransactionStatus.MANUAL_REVIEW,
          manualReviewReason: amountDecision.reason,
          ...bankTransactionDataFromWebhook(webhook, data),
        },
      });

      await audit(tx, {
        actorId: null,
        entity: "PaymentIntent",
        entityId: intent.id,
        action: "payment_intent.manual_review",
        diff: buildAuditDiff(
          { status: intent.status },
          { status: updatedIntent.status },
        ),
      });
      await cancelPendingPaymentReminderJobs(tx, {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
      });

      return {
        kind: "manual_review" as const,
        bankTransaction,
        paymentIntent: updatedIntent,
        reason: amountDecision.reason ?? undefined,
        bookingId: intent.booking.id,
        orderCode: intent.booking.orderCode,
        pnr: intent.booking.pnr,
        transferredAmount: data.amount,
        remainingAmount: Math.max(remainingIntentAmount - data.amount, 0),
      };
    }

    const paidAt = parsePayOSTransactionDateTime(data.transactionDateTime) ?? new Date();
    const paymentStatus = amountDecision.decision === "PAID" ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    const intentStatus = mapIntentStatus(amountDecision.decision);
    const payment = await tx.payment.create({
      data: {
        bookingId: intent.bookingId,
        paymentIntentId: intent.id,
        method: PaymentMethod.QR,
        amount: data.amount,
        currency: data.currency || intent.currency,
        status: paymentStatus,
        paidAt,
        transactionRef: data.reference,
        reconciledAt: new Date(),
        notes: `payOS webhook ${data.paymentLinkId}`,
      },
    });
    const bankTransaction = await tx.bankTransaction.create({
      data: {
        dedupeKey,
        paymentIntentId: intent.id,
        paymentId: payment.id,
        status: BankTransactionStatus.MATCHED,
        ...bankTransactionDataFromWebhook(webhook, data),
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
        source: "payos",
        eventType: "PAYMENT_AUTO_MATCHED",
        title: "Tự động đối soát thanh toán QR",
        payload: toJsonValue({
          paymentId: payment.id,
          paymentIntentId: intent.id,
          bankTransactionId: bankTransaction.id,
          amount: payment.amount,
          status: payment.status,
          reference: data.reference,
          paymentLinkId: data.paymentLinkId,
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

    return {
      kind: "matched" as const,
      bankTransaction,
      payment,
      paymentIntent: updatedIntent,
      reason: amountDecision.reason ?? undefined,
      bookingId: intent.booking.id,
      orderCode: intent.booking.orderCode,
      pnr: intent.booking.pnr,
      transferredAmount: data.amount,
      remainingAmount: Math.max(remainingIntentAmount - data.amount, 0),
    };
  });
}
