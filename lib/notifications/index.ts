import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/channels/email";
import { sendSlack } from "@/lib/notifications/channels/slack";
import { sendTelegram } from "@/lib/notifications/channels/telegram";
import { enqueueNotification } from "@/lib/notifications/queue";
import { renderBookingCancelled } from "@/lib/notifications/templates/bookingCancelled";
import { renderBookingHold } from "@/lib/notifications/templates/bookingHold";
import { renderBookingIssued } from "@/lib/notifications/templates/bookingIssued";
import { renderInternalAlert } from "@/lib/notifications/templates/internalAlert";
import type { BookingEmailContext } from "@/lib/notifications/templates/types";

export type NotificationEvent =
  | { type: "BOOKING_HOLD"; bookingId: string }
  | { type: "BOOKING_ISSUED"; bookingId: string; ticketNumbers?: Array<{ passengerName: string; ticketNumber: string }> }
  | { type: "BOOKING_CANCELLED"; bookingId: string; reason: string; refundAmount?: number }
  | { type: "INTERNAL_ALERT"; severity: "info" | "warn" | "error"; message: string; context?: Record<string, unknown> };

function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(value) : "-";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
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

  if (event.type === "BOOKING_ISSUED") {
    await notifyBookingIssued(event);
    return;
  }

  if (event.type === "BOOKING_CANCELLED") {
    await notifyBookingCancelled(event);
    return;
  }

  const text = renderInternalAlert(event);
  await Promise.all([sendSlack({ text }), sendTelegram({ text })]);
}

export async function notify(event: NotificationEvent): Promise<void> {
  enqueueNotification(() => processNotification(event));
}
