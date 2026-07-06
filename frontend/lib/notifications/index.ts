import { PaymentIntentProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/channels/email";
import { sendSlack } from "@/lib/notifications/channels/slack";
import { sendN8nZalo } from "@/lib/notifications/channels/n8nZalo";
import { sendTelegram } from "@/lib/notifications/channels/telegram";
import { buildFlightLegSummaries, flightLegLines } from "@/lib/notifications/flightSummary";
import { enqueueNotification } from "@/lib/notifications/queue";
import { renderBookingCancelled } from "@/lib/notifications/templates/bookingCancelled";
import { renderBookingHold } from "@/lib/notifications/templates/bookingHold";
import { renderBookingIssued } from "@/lib/notifications/templates/bookingIssued";
import { renderInternalAlert } from "@/lib/notifications/templates/internalAlert";
import type { BookingEmailContext } from "@/lib/notifications/templates/types";

export type NotificationEvent =
  | { type: "BOOKING_HOLD"; bookingId: string }
  | { type: "BOOKING_HOLD_CREATED"; bookingId: string; paymentIntentId?: string | null; reused?: boolean }
  | { type: "BOOKING_ISSUED"; bookingId: string; ticketNumbers?: Array<{ passengerName: string; ticketNumber: string }> }
  | { type: "BOOKING_CANCELLED"; bookingId: string; reason: string; refundAmount?: number }
  | {
      type: "SEPAY_PAYMENT_MATCHED";
      bookingId: string;
      paymentIntentId?: string | null;
      paymentId?: string | null;
      bankTransactionId?: string | null;
      transferredAmount?: number | null;
      remainingAmount?: number | null;
    }
  | {
      type: "SEPAY_PAYMENT_REVIEW";
      bookingId?: string | null;
      paymentIntentId?: string | null;
      paymentId?: string | null;
      bankTransactionId?: string | null;
      reason?: string | null;
      transferredAmount?: number | null;
      remainingAmount?: number | null;
    }
  | { type: "INTERNAL_ALERT"; severity: "info" | "warn" | "error"; message: string; context?: Record<string, unknown> };

function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(value) : "-";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function appBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || "https://tanphuapg.com";
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
  return normalized.replace(/\/+$/, "");
}

function bookingAdminUrl(bookingId: string): string {
  return `${appBaseUrl()}/admin/bookings/${bookingId}`;
}

function collectPnrText(booking: {
  pnr: string | null;
  pnrs: Array<{ pnr: string }>;
}): string {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const value of [booking.pnr, ...booking.pnrs.map((pnr) => pnr.pnr)]) {
    const normalized = String(value || "").trim().toUpperCase();

    if (normalized && !normalized.startsWith("PENDING") && !seen.has(normalized)) {
      seen.add(normalized);
      values.push(normalized);
    }
  }

  return values.length > 0 ? values.join(" / ") : "PENDING";
}

async function getOpsBookingContext(
  bookingId: string,
  paymentIntentId?: string | null,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      pnrs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!booking) {
    return null;
  }

  const paymentIntent = paymentIntentId
    ? await prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } })
    : await prisma.paymentIntent.findFirst({
        where: { bookingId, provider: PaymentIntentProvider.SEPAY },
        orderBy: { createdAt: "desc" },
      });

  return {
    booking,
    paymentIntent,
    pnrs: collectPnrText(booking),
    customerName: booking.customer?.fullName ?? "-",
    customerPhone: booking.customer?.phone ?? "-",
    adminUrl: bookingAdminUrl(booking.id),
  };
}

async function getBookingContext(bookingId: string): Promise<BookingEmailContext | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      pnrs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!booking) {
    return null;
  }

  const pnrLabel = booking.pnr ?? booking.pnrs[0]?.pnr ?? "PENDING";

  return {
    orderCode: booking.orderCode,
    customerName: booking.customer?.fullName ?? "Quý khách",
    customerEmail: booking.customer?.email ?? null,
    pnr: pnrLabel,
    route: booking.routeSummary,
    departAt: formatDate(booking.departAt),
    passengerCount: booking.adt + booking.chd + booking.inf,
    sellAmount: formatMoney(booking.saleAmount),
    currency: booking.currency,
    ttlExpiresAt: formatDate(booking.ttlExpiresAt),
  };
}

async function notifyBookingHold(event: Extract<NotificationEvent, { type: "BOOKING_HOLD" }>): Promise<void> {
  const context = await getBookingContext(event.bookingId);

  if (!context) {
    console.error("booking notification skipped: booking not found", event.bookingId);
    return;
  }

  if (context.customerEmail) {
    await sendEmail({ to: context.customerEmail, ...renderBookingHold(context) });
  }

  const text = renderInternalAlert({
    severity: "info",
    message: `Hold thành công đơn ${context.orderCode ?? context.pnr}`,
    context: { bookingId: event.bookingId, orderCode: context.orderCode, pnr: context.pnr, route: context.route },
  });
  await Promise.all([sendSlack({ text }), sendTelegram({ text })]);
}

async function notifyBookingHoldCreated(event: Extract<NotificationEvent, { type: "BOOKING_HOLD_CREATED" }>): Promise<void> {
  const context = await getOpsBookingContext(event.bookingId, event.paymentIntentId);

  if (!context) {
    console.error("booking hold telegram skipped: booking not found", event.bookingId);
    return;
  }

  const { booking, paymentIntent } = context;
  const rawRequest = (booking.namthanhRawJson as { request?: { vatInvoice?: { companyName?: string; taxId?: string; address?: string; email?: string } | null } } | null)?.request;
  const vat = rawRequest?.vatInvoice;
  const vatLine = vat && (vat.companyName || vat.taxId)
    ? `🧾 XUẤT HĐ VAT: ${vat.companyName || "-"} · MST ${vat.taxId || "-"}${vat.address ? ` · ${vat.address}` : ""}${vat.email ? ` · ${vat.email}` : ""}`
    : "";
  const flightLegs = buildFlightLegSummaries(booking);
  const flightLines = flightLegLines(flightLegs);
  const text = [
    "*PNR MỚI - CẦN THEO DÕI*",
    `Đơn: ${booking.orderCode}`,
    `PNR: ${context.pnrs}`,
    `Khách: ${context.customerName} - ${context.customerPhone}`,
    `Hành trình: ${booking.routeSummary}`,
    ...flightLines,
    `Số tiền cần thu: ${formatMoney(paymentIntent?.amount ?? booking.saleAmount)} ${booking.currency}`,
    `Nội dung CK: ${paymentIntent?.transferContent ?? "Chưa tạo được QR SePay"}`,
    `TTL: ${formatDate(booking.ttlExpiresAt)}`,
    `QR SePay: ${paymentIntent ? (event.reused ? "Đã có sẵn" : "Đã tạo mới") : "Chưa tạo"}`,
    vatLine,
    `Admin: ${context.adminUrl}`,
  ].filter(Boolean).join("\n");

  // Thông báo hold cho nhân sự: Telegram + nhóm Zalo (qua webhook n8n).
  await Promise.all([
    sendTelegram({ text }),
    sendN8nZalo({ content: text.replace(/\*/g, "") }),
  ]);

  // Gửi email xác nhận giữ chỗ cho KHÁCH (link thanh toán + QR VietQR + link "Chuyến bay của tôi")
  // để khách trả sau / lấy lại đơn kể cả khi đóng tab.
  if (booking.customer?.email) {
    // VietQR tĩnh (không hết hạn) để khách quét/trả ngay trong email.
    const qrImageUrl =
      paymentIntent?.bin && paymentIntent?.accountNumber
        ? `https://img.vietqr.io/image/${paymentIntent.bin}-${paymentIntent.accountNumber}-compact2.png?amount=${paymentIntent.amount}&addInfo=${encodeURIComponent(paymentIntent.transferContent ?? "")}${paymentIntent.accountName ? `&accountName=${encodeURIComponent(paymentIntent.accountName)}` : ""}`
        : null;
    await sendEmail({
      to: booking.customer.email,
      ...renderBookingHold({
        orderCode: booking.orderCode,
        customerName: booking.customer.fullName ?? "Quý khách",
        customerEmail: booking.customer.email,
        pnr: context.pnrs,
        route: booking.routeSummary,
        departAt: formatDate(booking.departAt),
        flightLegs,
        passengerCount: booking.adt + booking.chd + booking.inf,
        sellAmount: formatMoney(booking.saleAmount),
        currency: booking.currency,
        ttlExpiresAt: formatDate(booking.ttlExpiresAt),
        paymentDue: formatMoney(paymentIntent?.amount ?? booking.saleAmount),
        checkoutUrl: `${appBaseUrl()}/booking/payment/${booking.id}`,
        transferContent: paymentIntent?.transferContent ?? null,
        accountNumber: paymentIntent?.accountNumber ?? null,
        accountName: paymentIntent?.accountName ?? null,
        bankName: paymentIntent?.bin ?? null,
        qrImageUrl,
        lookupUrl: `${appBaseUrl()}/tra-cuu`,
      }),
    });
  }
}

async function notifyBookingIssued(event: Extract<NotificationEvent, { type: "BOOKING_ISSUED" }>): Promise<void> {
  const context = await getBookingContext(event.bookingId);

  if (!context) {
    console.error("booking notification skipped: booking not found", event.bookingId);
    return;
  }

  if (context.customerEmail) {
    await sendEmail({ to: context.customerEmail, ...renderBookingIssued({ ...context, ticketNumbers: event.ticketNumbers }) });
  }

  const text = renderInternalAlert({
    severity: "info",
    message: `Issue thành công đơn ${context.orderCode ?? context.pnr}`,
    context: { bookingId: event.bookingId, orderCode: context.orderCode, pnr: context.pnr },
  });
  await Promise.all([sendSlack({ text }), sendTelegram({ text })]);
}

async function notifySepayPaymentMatched(event: Extract<NotificationEvent, { type: "SEPAY_PAYMENT_MATCHED" }>): Promise<void> {
  const context = await getOpsBookingContext(event.bookingId, event.paymentIntentId);

  if (!context) {
    console.error("sepay matched telegram skipped: booking not found", event.bookingId);
    return;
  }

  const [payment, bankTransaction] = await Promise.all([
    event.paymentId ? prisma.payment.findUnique({ where: { id: event.paymentId } }) : null,
    event.bankTransactionId ? prisma.bankTransaction.findUnique({ where: { id: event.bankTransactionId } }) : null,
  ]);
  const receivedAmount = payment?.amount ?? bankTransaction?.amount ?? event.transferredAmount ?? 0;
  const expectedAmount = context.paymentIntent?.amount ?? context.booking.saleAmount;
  const remainingAmount = event.remainingAmount ?? Math.max(expectedAmount - receivedAmount, 0);

  const text = [
    remainingAmount > 0 ? "*THANH TOAN MOT PHAN - CHUA XUAT VE*" : "*THANH TOAN DA KHOP - CAN XUAT VE*",
    `Đơn: ${context.booking.orderCode}`,
    `PNR: ${context.pnrs}`,
    `Khách: ${context.customerName} - ${context.customerPhone}`,
    `Nội dung CK chuẩn: ${context.paymentIntent?.transferContent ?? "-"}`,
    `Nội dung ngân hàng: ${bankTransaction?.description ?? "-"}`,
    `Số tiền phải thu: ${formatMoney(expectedAmount)} ${context.booking.currency}`,
    `Số tiền nhận: ${formatMoney(receivedAmount)} ${payment?.currency ?? bankTransaction?.currency ?? context.booking.currency}`,
    `Còn thiếu: ${formatMoney(Math.max(remainingAmount, 0))} ${context.booking.currency}`,
    `Mã GD: ${payment?.transactionRef ?? bankTransaction?.reference ?? "-"}`,
    `Admin: ${context.adminUrl}`,
  ].join("\n");

  // Thanh toán thành công: báo nhân sự qua Telegram + nhóm Zalo (webhook n8n).
  await Promise.all([
    sendTelegram({ text }),
    sendN8nZalo({ content: text.replace(/\*/g, "") }),
  ]);
}

async function notifySepayPaymentReview(event: Extract<NotificationEvent, { type: "SEPAY_PAYMENT_REVIEW" }>): Promise<void> {
  const context = event.bookingId ? await getOpsBookingContext(event.bookingId, event.paymentIntentId) : null;
  const [bankTransaction, payment] = await Promise.all([
    event.bankTransactionId ? prisma.bankTransaction.findUnique({ where: { id: event.bankTransactionId } }) : null,
    event.paymentId ? prisma.payment.findUnique({ where: { id: event.paymentId } }) : null,
  ]);
  const booking = context?.booking;
  const currency = payment?.currency ?? bankTransaction?.currency ?? booking?.currency ?? "VND";

  const text = [
    "*CẦN KIỂM TRA THANH TOÁN SEPAY*",
    `Lý do: ${event.reason ?? bankTransaction?.manualReviewReason ?? "unknown"}`,
    `Đơn: ${booking?.orderCode ?? "-"}`,
    `PNR: ${context?.pnrs ?? "-"}`,
    `Nội dung CK chuẩn: ${context?.paymentIntent?.transferContent ?? "-"}`,
    `Nội dung ngân hàng: ${bankTransaction?.description ?? "-"}`,
    `Số tiền nhận: ${formatMoney(payment?.amount ?? bankTransaction?.amount ?? event.transferredAmount ?? 0)} ${currency}`,
    `Còn thiếu: ${event.remainingAmount != null ? formatMoney(Math.max(event.remainingAmount, 0)) : "-"}`,
    `Mã GD: ${payment?.transactionRef ?? bankTransaction?.reference ?? "-"}`,
    `Admin: ${context?.adminUrl ?? "-"}`,
  ].join("\n");

  await sendTelegram({ text });
}

async function notifyBookingCancelled(event: Extract<NotificationEvent, { type: "BOOKING_CANCELLED" }>): Promise<void> {
  const context = await getBookingContext(event.bookingId);

  if (!context) {
    console.error("booking notification skipped: booking not found", event.bookingId);
    return;
  }

  if (context.customerEmail) {
    await sendEmail({ to: context.customerEmail, ...renderBookingCancelled({ ...context, reason: event.reason, refundAmount: event.refundAmount }) });
  }

  const text = renderInternalAlert({
    severity: "warn",
    message: `Cancel đơn ${context.orderCode ?? context.pnr}`,
    context: { bookingId: event.bookingId, orderCode: context.orderCode, reason: event.reason, refundAmount: event.refundAmount },
  });
  await Promise.all([sendSlack({ text }), sendTelegram({ text })]);
}

async function processNotification(event: NotificationEvent): Promise<void> {
  if (event.type === "BOOKING_HOLD") {
    await notifyBookingHold(event);
    return;
  }

  if (event.type === "BOOKING_HOLD_CREATED") {
    await notifyBookingHoldCreated(event);
    return;
  }

  if (event.type === "BOOKING_ISSUED") {
    await notifyBookingIssued(event);
    return;
  }

  if (event.type === "BOOKING_CANCELLED") {
    await notifyBookingCancelled(event);
    return;
  }

  if (event.type === "SEPAY_PAYMENT_MATCHED") {
    await notifySepayPaymentMatched(event);
    return;
  }

  if (event.type === "SEPAY_PAYMENT_REVIEW") {
    await notifySepayPaymentReview(event);
    return;
  }

  const text = renderInternalAlert(event);
  await Promise.all([sendSlack({ text }), sendTelegram({ text })]);
}

export async function notify(event: NotificationEvent): Promise<void> {
  enqueueNotification(() => processNotification(event));
}

export async function notifyNow(event: NotificationEvent): Promise<void> {
  await processNotification(event);
}
