import { BookingStatus, RefundStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { HELD_EXPIRING_WINDOW_MINUTES } from "@/lib/notifications/sweeps";

// Phần H — API tổng hợp vận hành (KHÔNG trả tiền lãi/doanh thu, scope RMS đã gỡ).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const QUEUE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];
// Đơn đã đi qua bước nhập thanh toán (rời HELD) — gồm cả nhánh thất bại để phễu phản ánh đúng.
const REACHED_PENDING: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.TICKETING,
  BookingStatus.TICKETED,
  BookingStatus.CANNOT_ISSUE,
  BookingStatus.REFUND_REQUIRED,
  BookingStatus.REFUNDED,
  BookingStatus.PAYMENT_FAILED,
];

// Mốc 0h theo giờ Việt Nam (UTC+7) biểu diễn dưới dạng Date UTC, để lọc createdAt/paidConfirmedAt.
function startOfVnDay(date: Date): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - VN_OFFSET_MS);
}

export function vnHour(date: Date): number {
  return new Date(date.getTime() + VN_OFFSET_MS).getUTCHours();
}

export function vnDateKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export interface OpsSummary {
  needTicketing: number;
  slaBreaches: number;
  heldActive: number;
  heldExpiring: number;
  refundPending: number;
  issueRateToday: number | null;
  avgPaidToTicketMin: number | null;
  byStatus: Array<{ status: BookingStatus; count: number }>;
  byAirline: Array<{ airline: string; count: number }>;
  topRoutes: Array<{ route: string; count: number }>;
  ordersByHour: Array<{ bucket: string; count: number }>;
  ticketsLast14d: Array<{ date: string; count: number }>;
}

function averageMinutes(deltasMs: number[]): number | null {
  if (deltasMs.length === 0) {
    return null;
  }

  const total = deltasMs.reduce((sum, value) => sum + value, 0);
  return Math.round(total / deltasMs.length / 60_000);
}

export async function getOpsSummary(now: Date = new Date()): Promise<OpsSummary> {
  const startToday = startOfVnDay(now);
  const start14d = new Date(startOfVnDay(now).getTime() - 13 * 24 * 60 * 60 * 1000);
  const heldThreshold = new Date(now.getTime() + HELD_EXPIRING_WINDOW_MINUTES * 60_000);

  const [
    needTicketing,
    slaBreaches,
    heldActive,
    heldExpiring,
    refundPending,
    paidToday,
    ticketedFromPaidToday,
    byStatusRaw,
    byAirlineRaw,
    topRoutesRaw,
    ordersToday,
    ticketEvents,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: { in: QUEUE_STATUSES } } }),
    prisma.booking.count({ where: { status: { in: QUEUE_STATUSES }, slaDueAt: { lt: now } } }),
    prisma.booking.count({ where: { status: BookingStatus.HELD } }),
    prisma.booking.count({
      where: { status: BookingStatus.HELD, ttlExpiresAt: { gt: now, lte: heldThreshold } },
    }),
    prisma.refund.count({ where: { status: { in: [RefundStatus.REQUIRED, RefundStatus.PROCESSING] } } }),
    prisma.booking.count({ where: { paidConfirmedAt: { gte: startToday } } }),
    prisma.booking.count({
      where: { paidConfirmedAt: { gte: startToday }, status: BookingStatus.TICKETED },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: start14d } },
    }),
    prisma.booking.groupBy({
      by: ["airline"],
      _count: { _all: true },
      where: { createdAt: { gte: start14d }, airline: { not: null } },
    }),
    prisma.booking.groupBy({
      by: ["routeSummary"],
      _count: { _all: true },
      where: { createdAt: { gte: start14d } },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: startToday } },
      select: { createdAt: true },
    }),
    prisma.bookingTimelineEvent.findMany({
      where: { eventType: "TICKET_ISSUED", occurredAt: { gte: start14d } },
      select: { occurredAt: true, booking: { select: { paidConfirmedAt: true } } },
    }),
  ]);

  const byStatus = byStatusRaw
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  const byAirline = byAirlineRaw
    .filter((row): row is typeof row & { airline: string } => row.airline !== null)
    .map((row) => ({ airline: row.airline, count: row._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topRoutes = topRoutesRaw
    .map((row) => ({ route: row.routeSummary, count: row._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const buckets = Array.from({ length: 8 }, (_, index) => ({
    bucket: `${index * 3}-${index * 3 + 3}h`,
    count: 0,
  }));
  for (const order of ordersToday) {
    buckets[Math.floor(vnHour(order.createdAt) / 3)].count += 1;
  }

  const ticketsByDay = new Map<string, number>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(startToday.getTime() - offset * 24 * 60 * 60 * 1000);
    ticketsByDay.set(vnDateKey(day), 0);
  }
  const paidToTicketDeltas: number[] = [];
  for (const event of ticketEvents) {
    const key = vnDateKey(event.occurredAt);
    if (ticketsByDay.has(key)) {
      ticketsByDay.set(key, (ticketsByDay.get(key) ?? 0) + 1);
    }

    const paidAt = event.booking?.paidConfirmedAt;
    if (paidAt) {
      const delta = event.occurredAt.getTime() - paidAt.getTime();
      if (delta >= 0) {
        paidToTicketDeltas.push(delta);
      }
    }
  }

  return {
    needTicketing,
    slaBreaches,
    heldActive,
    heldExpiring,
    refundPending,
    issueRateToday: paidToday > 0 ? Number((ticketedFromPaidToday / paidToday).toFixed(3)) : null,
    avgPaidToTicketMin: averageMinutes(paidToTicketDeltas),
    byStatus,
    byAirline,
    topRoutes,
    ordersByHour: buckets,
    ticketsLast14d: Array.from(ticketsByDay, ([date, count]) => ({ date, count })),
  };
}

export const funnelQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d"]).default("today"),
});

export type FunnelQuery = z.infer<typeof funnelQuerySchema>;

export interface FunnelResult {
  range: FunnelQuery["range"];
  search: number | null;
  held: number;
  pendingPayment: number;
  paid: number;
  ticketed: number;
  cannotIssueRate: number | null;
  avgPaidToTicketMin: number | null;
  abandoned: number;
}

function funnelStart(range: FunnelQuery["range"], now: Date): Date {
  const startToday = startOfVnDay(now);

  if (range === "7d") {
    return new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(startToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  }

  return startToday;
}

export async function getFunnel(query: FunnelQuery, now: Date = new Date()): Promise<FunnelResult> {
  const start = funnelStart(query.range, now);
  const createdInRange = { createdAt: { gte: start } };

  const [held, pendingPayment, paid, ticketed, ticketEvents] = await Promise.all([
    prisma.booking.count({ where: createdInRange }),
    prisma.booking.count({ where: { ...createdInRange, status: { in: REACHED_PENDING } } }),
    prisma.booking.count({ where: { ...createdInRange, paidConfirmedAt: { not: null } } }),
    prisma.booking.count({ where: { ...createdInRange, status: BookingStatus.TICKETED } }),
    prisma.bookingTimelineEvent.findMany({
      where: { eventType: "TICKET_ISSUED", occurredAt: { gte: start } },
      select: { occurredAt: true, booking: { select: { paidConfirmedAt: true } } },
    }),
  ]);

  const deltas: number[] = [];
  for (const event of ticketEvents) {
    const paidAt = event.booking?.paidConfirmedAt;
    if (paidAt) {
      const delta = event.occurredAt.getTime() - paidAt.getTime();
      if (delta >= 0) {
        deltas.push(delta);
      }
    }
  }

  return {
    range: query.range,
    // Không có bảng log tìm kiếm — top phễu chưa theo dõi được.
    search: null,
    held,
    pendingPayment,
    paid,
    ticketed,
    cannotIssueRate: paid > 0 ? Number(((paid - ticketed) / paid).toFixed(3)) : null,
    avgPaidToTicketMin: averageMinutes(deltas),
    abandoned: Math.max(held - pendingPayment, 0),
  };
}
