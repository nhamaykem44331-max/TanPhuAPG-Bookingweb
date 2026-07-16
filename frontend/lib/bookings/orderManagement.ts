import { randomBytes } from "node:crypto";

import { BookingStatus, NotificationJobStatus, PaymentIntentStatus, Prisma, type Booking, type BookingPnr, type PaymentIntent } from "@prisma/client";

import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { prisma } from "@/lib/db";
import { cancelPayOSPaymentLink } from "@/lib/payments/providers/payos";

type Tx = Prisma.TransactionClient;

interface ExpirableBookingRecord {
  id: string;
  orderCode: string;
  pnr: string | null;
  status: BookingStatus;
  ttlExpiresAt: Date | null;
  pnrs: Pick<BookingPnr, "id" | "pnr" | "timelimit">[];
  paymentIntents: Pick<PaymentIntent, "id" | "status" | "providerOrderCode" | "paymentLinkId">[];
}

export interface BookingOrderSyncResult {
  bookingId: string;
  orderCode: string;
  expiredNow: boolean;
  ttlExpiresAt: Date | null;
}

interface CancelTarget {
  providerOrderCode: string;
  paymentLinkId: string | null;
}

function bangkokDateCode(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "00";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}${month}${day}`;
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

export function buildBackfillOrderCode(booking: Pick<Booking, "id" | "createdAt">): string {
  const normalizedId = booking.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `APG-${bangkokDateCode(booking.createdAt)}-${normalizedId.slice(-8)}`;
}

export async function generateUniqueOrderCode(tx: Tx, now = new Date()): Promise<string> {
  const prefix = `APG-${bangkokDateCode(now)}`;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const code = `${prefix}-${suffix}`;
    const exists = await tx.booking.findUnique({
      where: { orderCode: code },
      select: { id: true },
    });

    if (!exists) {
      return code;
    }
  }

  throw new Error("Không tạo được mã đơn hàng duy nhất.");
}

export function deriveEarliestPnrTimelimit(
  pnrs: Array<Pick<BookingPnr, "timelimit">>,
  fallback: Date | null = null,
): Date | null {
  const validTimes = pnrs
    .map((pnr) => pnr.timelimit)
    .filter((timelimit): timelimit is Date => !!timelimit)
    .sort((left, right) => left.getTime() - right.getTime());

  return validTimes[0] ?? fallback;
}

function dueForExpiry(booking: ExpirableBookingRecord, now: Date): boolean {
  if (booking.status !== BookingStatus.HELD && booking.status !== BookingStatus.PENDING_PAYMENT) {
    return false;
  }

  const earliest = deriveEarliestPnrTimelimit(booking.pnrs, booking.ttlExpiresAt);

  return !!earliest && earliest.getTime() <= now.getTime();
}

async function cancelProviderLinks(targets: CancelTarget[]): Promise<void> {
  for (const target of targets) {
    try {
      const cancelTarget = target.paymentLinkId || Number(target.providerOrderCode);
      await cancelPayOSPaymentLink(cancelTarget, "Order expired by earliest PNR timelimit");
    } catch (error) {
      console.error("cancel expired payOS link failed", {
        providerOrderCode: target.providerOrderCode,
        paymentLinkId: target.paymentLinkId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function syncBookingOrderByIdTx(tx: Tx, bookingId: string, now: Date): Promise<BookingOrderSyncResult & { cancelTargets: CancelTarget[] } | null> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      pnrs: {
        select: {
          id: true,
          pnr: true,
          timelimit: true,
        },
        orderBy: { timelimit: "asc" },
      },
      paymentIntents: {
        where: {
          status: {
            in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL],
          },
        },
        select: {
          id: true,
          status: true,
          providerOrderCode: true,
          paymentLinkId: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  const earliestTimelimit = deriveEarliestPnrTimelimit(booking.pnrs, booking.ttlExpiresAt);
  let nextBooking = booking;
  let expiredNow = false;
  const cancelTargets: CancelTarget[] = [];

  if (!sameInstant(booking.ttlExpiresAt, earliestTimelimit)) {
    nextBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        ttlExpiresAt: earliestTimelimit,
      },
      include: {
        pnrs: {
          select: {
            id: true,
            pnr: true,
            timelimit: true,
          },
          orderBy: { timelimit: "asc" },
        },
        paymentIntents: {
          where: {
            status: {
              in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL],
            },
          },
          select: {
            id: true,
            status: true,
            providerOrderCode: true,
            paymentLinkId: true,
          },
        },
      },
    });
  }

  if (!dueForExpiry(nextBooking, now)) {
    return {
      bookingId: nextBooking.id,
      orderCode: nextBooking.orderCode,
      expiredNow: false,
      ttlExpiresAt: nextBooking.ttlExpiresAt,
      cancelTargets,
    };
  }

  const expiredPnr = nextBooking.pnrs.find((pnr) => pnr.timelimit && pnr.timelimit.getTime() <= now.getTime()) ?? null;
  const expiredBooking = await tx.booking.update({
    where: { id: nextBooking.id },
    data: {
      status: BookingStatus.EXPIRED,
      ttlExpiresAt: earliestTimelimit,
    },
  });

  const expiredIntents = nextBooking.paymentIntents.length > 0
    ? await Promise.all(
        nextBooking.paymentIntents.map((intent) =>
          tx.paymentIntent.update({
            where: { id: intent.id },
            data: { status: PaymentIntentStatus.EXPIRED, activeKey: null },
          }),
        ),
      )
    : [];

  if (expiredIntents.length > 0) {
    cancelTargets.push(
      ...expiredIntents.map((intent) => ({
        providerOrderCode: intent.providerOrderCode,
        paymentLinkId: intent.paymentLinkId,
      })),
    );
  }

  await tx.notificationJob.updateMany({
    where: {
      bookingId: nextBooking.id,
      status: {
        in: [NotificationJobStatus.PENDING, NotificationJobStatus.PROCESSING],
      },
    },
    data: {
      status: NotificationJobStatus.CANCELLED,
      lastError: "ORDER_EXPIRED_BY_PNR_TTL",
    },
  });

  await tx.bookingTimelineEvent.create({
    data: {
      bookingId: nextBooking.id,
      pnr: expiredPnr?.pnr ?? nextBooking.pnr,
      source: "system",
      eventType: "BOOKING_EXPIRED",
      title: "Đơn hàng hết hạn theo TTL sớm nhất của PNR",
      payload: {
        orderCode: nextBooking.orderCode,
        earliestTimelimit: earliestTimelimit?.toISOString() ?? null,
        expiredPnr: expiredPnr?.pnr ?? null,
        expiredPnrId: expiredPnr?.id ?? null,
        paymentIntentIds: expiredIntents.map((intent) => intent.id),
      },
      occurredAt: now,
    },
  });

  await audit(tx, {
    actorId: null,
    entity: "Booking",
    entityId: nextBooking.id,
    action: "booking.expire_by_order_ttl",
    diff: buildAuditDiff(
      {
        status: nextBooking.status,
        ttlExpiresAt: nextBooking.ttlExpiresAt?.toISOString() ?? null,
      },
      {
        status: expiredBooking.status,
        ttlExpiresAt: expiredBooking.ttlExpiresAt?.toISOString() ?? null,
      },
    ),
  });

  expiredNow = true;

  return {
    bookingId: expiredBooking.id,
    orderCode: expiredBooking.orderCode,
    expiredNow,
    ttlExpiresAt: expiredBooking.ttlExpiresAt,
    cancelTargets,
  };
}

export async function syncBookingOrderById(bookingId: string, now = new Date()): Promise<BookingOrderSyncResult | null> {
  const result = await prisma.$transaction((tx) => syncBookingOrderByIdTx(tx, bookingId, now));

  if (result?.cancelTargets.length) {
    await cancelProviderLinks(result.cancelTargets);
  }

  return result
    ? {
        bookingId: result.bookingId,
        orderCode: result.orderCode,
        expiredNow: result.expiredNow,
        ttlExpiresAt: result.ttlExpiresAt,
      }
    : null;
}

export async function syncExpiredBookingOrders(limit = 50, now = new Date()): Promise<BookingOrderSyncResult[]> {
  const dueBookings = await prisma.booking.findMany({
    where: {
      status: {
        in: [BookingStatus.HELD, BookingStatus.PENDING_PAYMENT],
      },
      OR: [
        {
          ttlExpiresAt: {
            lte: now,
          },
        },
        {
          pnrs: {
            some: {
              timelimit: {
                lte: now,
              },
            },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: {
      ttlExpiresAt: {
        sort: "asc",
        nulls: "last",
      },
    },
    take: limit,
  });

  const results: BookingOrderSyncResult[] = [];

  for (const booking of dueBookings) {
    const result = await syncBookingOrderById(booking.id, now);

    if (result) {
      results.push(result);
    }
  }

  return results;
}
