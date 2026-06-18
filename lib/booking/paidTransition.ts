import { BookingStatus, NotificationAudience, NotificationJobChannel, Prisma } from "@prisma/client";

import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { canTransition } from "@/lib/booking/stateMachine";
import { enqueueNotification } from "@/lib/notifications/jobs";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

interface SettleArgs {
  bookingId: string;
  paidAt: Date;
  actorId?: string | null;
  source?: string;
}

// Phần D — nguồn duy nhất cho bước HELD/PENDING_PAYMENT → PAID.
// Khi booking đã đủ tiền và đang ở trạng thái cho phép: đặt SLA xuất vé, ghi
// timeline + audit, đẩy job NEEDS_TICKETING (Zalo OA, nội bộ) để hàng đợi chạy thật.
// Idempotent: gọi nhiều lần an toàn nhờ canTransition + idempotencyKey của job.
export async function settleBookingIfFullyPaid(
  tx: Prisma.TransactionClient,
  args: SettleArgs,
): Promise<boolean> {
  const booking = await tx.booking.findUnique({
    where: { id: args.bookingId },
    select: { id: true, status: true, saleAmount: true, orderCode: true, pnr: true },
  });

  if (!booking || !canTransition(booking.status, BookingStatus.PAID)) {
    return false;
  }

  const payments = await tx.payment.findMany({
    where: { bookingId: booking.id },
    select: { amount: true, status: true },
  });
  const summary = calculatePaymentSummary(payments, booking.saleAmount);

  if (summary.balance > 0) {
    return false;
  }

  const slaMinutes = Number(process.env.TICKETING_SLA_MINUTES ?? 30);
  const slaDueAt = new Date(args.paidAt.getTime() + slaMinutes * 60_000);

  const paidBooking = await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.PAID,
      paidConfirmedAt: args.paidAt,
      slaDueAt,
    },
  });

  await tx.bookingTimelineEvent.create({
    data: {
      bookingId: booking.id,
      pnr: booking.pnr,
      source: args.source ?? "system",
      eventType: "BOOKING_PAID",
      title: "Khách thanh toán đủ — vào hàng đợi xuất vé",
      payload: toJsonValue({ slaMinutes, slaDueAt: slaDueAt.toISOString() }),
      occurredAt: args.paidAt,
    },
  });

  await audit(tx, {
    actorId: args.actorId ?? null,
    entity: "Booking",
    entityId: booking.id,
    action: "booking.paid",
    diff: buildAuditDiff(
      { status: booking.status, slaDueAt: null },
      { status: paidBooking.status, slaDueAt: slaDueAt.toISOString() },
    ),
  });

  await enqueueNotification(tx, {
    type: "NEEDS_TICKETING",
    channel: NotificationJobChannel.ZALO_OA,
    audience: NotificationAudience.INTERNAL,
    bookingId: booking.id,
    idempotencyKey: `needs-ticketing:${booking.id}`,
    payload: {
      orderCode: booking.orderCode,
      slaDueAt: slaDueAt.toISOString(),
    },
  });

  return true;
}
