import { BookingStatus, type Prisma as PrismaNamespace } from "@prisma/client";

import { bookingListWhereForRole, type OwnershipContext } from "@/lib/auth/ownership";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";
import type { TicketingQueueQuery } from "@/lib/bookings/schemas";

// Phần F — hàng đợi xuất vé: chỉ PAID + TICKETING, ưu tiên đơn sắp/đã quá hạn SLA.
const QUEUE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];

export type TicketingSlaState = "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "NO_SLA";

export interface TicketingQueueRecord {
  id: string;
  orderCode: string;
  pnr: string | null;
  status: string;
  airline: string | null;
  route: string;
  departureDate: string | null;
  passengerCount: number;
  sellPrice: number;
  totalPaid: number;
  customerName: string | null;
  paidConfirmedAt: string | null;
  slaDueAt: string | null;
  minutesToSla: number | null;
  slaState: TicketingSlaState;
  assignedToId: string | null;
  assignedToName: string | null;
}

export interface TicketingQueueResult {
  items: TicketingQueueRecord[];
  total: number;
  overdue: number;
  unassigned: number;
  limit: number;
  offset: number;
}

export const DUE_SOON_THRESHOLD_MINUTES = 10;

// Phân loại SLA xuất vé so với thời điểm hiện tại (now tính bằng ms).
export function classifyTicketingSla(
  slaDueAt: Date | null,
  now: number,
): { state: TicketingSlaState; minutes: number | null } {
  if (!slaDueAt) {
    return { state: "NO_SLA", minutes: null };
  }

  const minutes = Math.round((slaDueAt.getTime() - now) / 60_000);

  if (minutes < 0) {
    return { state: "OVERDUE", minutes };
  }

  if (minutes <= DUE_SOON_THRESHOLD_MINUTES) {
    return { state: "DUE_SOON", minutes };
  }

  return { state: "ON_TRACK", minutes };
}

export async function listTicketingQueue(
  query: TicketingQueueQuery,
  ownership?: OwnershipContext,
): Promise<TicketingQueueResult> {
  const now = Date.now();
  const baseWhere: PrismaNamespace.BookingWhereInput = {
    status: { in: QUEUE_STATUSES },
    ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    ...(query.unassigned ? { assignedToId: null } : {}),
    ...(query.overdueOnly ? { slaDueAt: { lt: new Date(now) } } : {}),
  };
  const where = ownership ? bookingListWhereForRole(ownership, baseWhere) : baseWhere;

  const [rows, total, overdue, unassigned] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { paidConfirmedAt: "asc" }],
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        orderCode: true,
        pnr: true,
        status: true,
        airline: true,
        routeSummary: true,
        departAt: true,
        adt: true,
        chd: true,
        inf: true,
        saleAmount: true,
        paidConfirmedAt: true,
        slaDueAt: true,
        assignedToId: true,
        customer: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        payments: { select: { amount: true, status: true } },
      },
    }),
    prisma.booking.count({ where }),
    prisma.booking.count({
      where: ownership
        ? bookingListWhereForRole(ownership, { status: { in: QUEUE_STATUSES }, slaDueAt: { lt: new Date(now) } })
        : { status: { in: QUEUE_STATUSES }, slaDueAt: { lt: new Date(now) } },
    }),
    prisma.booking.count({
      where: ownership
        ? bookingListWhereForRole(ownership, { status: { in: QUEUE_STATUSES }, assignedToId: null })
        : { status: { in: QUEUE_STATUSES }, assignedToId: null },
    }),
  ]);

  const items: TicketingQueueRecord[] = rows.map((row) => {
    const summary = calculatePaymentSummary(row.payments, row.saleAmount);
    const sla = classifyTicketingSla(row.slaDueAt, now);

    return {
      id: row.id,
      orderCode: row.orderCode,
      pnr: row.pnr,
      status: row.status,
      airline: row.airline,
      route: row.routeSummary,
      departureDate: row.departAt?.toISOString() ?? null,
      passengerCount: row.adt + row.chd + row.inf,
      sellPrice: row.saleAmount,
      totalPaid: summary.totalPaid,
      customerName: row.customer?.fullName ?? null,
      paidConfirmedAt: row.paidConfirmedAt?.toISOString() ?? null,
      slaDueAt: row.slaDueAt?.toISOString() ?? null,
      minutesToSla: sla.minutes,
      slaState: sla.state,
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo?.fullName ?? null,
    };
  });

  return {
    items,
    total,
    overdue,
    unassigned,
    limit: query.limit,
    offset: query.offset,
  };
}
