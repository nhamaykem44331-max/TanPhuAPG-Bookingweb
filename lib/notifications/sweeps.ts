import { BookingStatus, NotificationAudience, NotificationJobChannel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

// Phần G.3 — cron quét đơn quá hạn / sắp hết hạn rồi đẩy job cảnh báo nội bộ.
// idempotencyKey @unique + createMany(skipDuplicates) đảm bảo mỗi đơn chỉ cảnh báo một lần.
export const HELD_EXPIRING_WINDOW_MINUTES = 10;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const SLA_QUEUE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];

// PAID/TICKETING đã quá slaDueAt → SLA_BREACH (Zalo OA nội bộ + Telegram dự phòng khẩn).
export async function sweepPaidOverSla(now: Date = new Date()): Promise<number> {
  const overdue = await prisma.booking.findMany({
    where: {
      status: { in: SLA_QUEUE_STATUSES },
      slaDueAt: { lt: now },
    },
    select: { id: true, orderCode: true, routeSummary: true, slaDueAt: true },
  });

  if (overdue.length === 0) {
    return 0;
  }

  const data: Prisma.NotificationJobCreateManyInput[] = [];

  for (const booking of overdue) {
    const payload = toJsonValue({
      orderCode: booking.orderCode,
      route: booking.routeSummary,
      slaDueAt: booking.slaDueAt?.toISOString() ?? null,
    });

    data.push(
      {
        type: "SLA_BREACH",
        channel: NotificationJobChannel.ZALO_OA,
        audience: NotificationAudience.INTERNAL,
        bookingId: booking.id,
        scheduledAt: now,
        idempotencyKey: `sla-breach:${booking.id}:zalo`,
        payload,
      },
      {
        type: "SLA_BREACH",
        channel: NotificationJobChannel.TELEGRAM,
        audience: NotificationAudience.INTERNAL,
        bookingId: booking.id,
        scheduledAt: now,
        idempotencyKey: `sla-breach:${booking.id}:telegram`,
        payload,
      },
    );
  }

  const created = await prisma.notificationJob.createMany({ data, skipDuplicates: true });
  return created.count;
}

// HELD sắp chạm timelimit (trong cửa sổ cảnh báo) → HELD_EXPIRING (Zalo OA nội bộ).
export async function sweepHeldExpiring(now: Date = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() + HELD_EXPIRING_WINDOW_MINUTES * 60_000);

  const expiring = await prisma.booking.findMany({
    where: {
      status: BookingStatus.HELD,
      ttlExpiresAt: { gt: now, lte: threshold },
    },
    select: { id: true, orderCode: true, routeSummary: true, ttlExpiresAt: true },
  });

  if (expiring.length === 0) {
    return 0;
  }

  const data: Prisma.NotificationJobCreateManyInput[] = expiring.map((booking) => ({
    type: "HELD_EXPIRING",
    channel: NotificationJobChannel.ZALO_OA,
    audience: NotificationAudience.INTERNAL,
    bookingId: booking.id,
    scheduledAt: now,
    idempotencyKey: `held-expiring:${booking.id}`,
    payload: toJsonValue({
      orderCode: booking.orderCode,
      route: booking.routeSummary,
      ttlExpiresAt: booking.ttlExpiresAt?.toISOString() ?? null,
    }),
  }));

  const created = await prisma.notificationJob.createMany({ data, skipDuplicates: true });
  return created.count;
}
