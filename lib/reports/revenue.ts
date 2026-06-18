import { BookingStatus, PaymentMethod, PaymentStatus, type Prisma } from "@prisma/client";
import { z } from "zod";

import { bookingListWhereForRole, type OwnershipContext } from "@/lib/auth/ownership";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";

export const REVENUE_REPORT_MODES = ["PAYMENT_DATE", "BOOKING_DATE", "ISSUE_DATE"] as const;
export type RevenueReportMode = (typeof REVENUE_REPORT_MODES)[number];

export const revenueReportQuerySchema = z.object({
  mode: z.enum(REVENUE_REPORT_MODES).default("PAYMENT_DATE"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  airline: z.string().trim().optional(),
  agentId: z.string().cuid().optional(),
  status: z.enum(Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]]).optional(),
  paymentMethod: z.enum(Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]]).optional(),
});

export type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema> & {
  from: string;
  to: string;
};

export interface RevenueReportSummary {
  bookingCount: number;
  ticketedCount: number;
  paymentCount: number;
  grossSale: number;
  netAmount: number;
  markupAmount: number;
  serviceFeeAmount: number;
  profit: number;
  collected: number;
  refunded: number;
  netCashIn: number;
  outstanding: number;
}

export interface RevenueReportBreakdownRow {
  key: string;
  bookingCount: number;
  paymentCount: number;
  grossSale: number;
  profit: number;
  collected: number;
  refunded: number;
  netCashIn: number;
}

export interface RevenueTimelinePoint {
  date: string;
  bookingCount: number;
  grossSale: number;
  profit: number;
  collected: number;
  refunded: number;
  netCashIn: number;
}

export interface RevenueReportBookingRow {
  bookingId: string;
  pnr: string | null;
  status: string;
  airline: string | null;
  route: string;
  customerName: string | null;
  createdByEmail: string | null;
  modeDate: string | null;
  grossSale: number;
  netAmount: number;
  markupAmount: number;
  serviceFeeAmount: number;
  profit: number;
  collected: number;
  refunded: number;
  outstanding: number;
  paymentCount: number;
}

export interface RevenueReportPaymentRow {
  paymentId: string;
  bookingId: string;
  pnr: string | null;
  airline: string | null;
  route: string;
  customerName: string | null;
  createdByEmail: string | null;
  method: string;
  status: string;
  paidAt: string | null;
  amount: number;
  collected: number;
  refunded: number;
  netCashIn: number;
}

export interface RevenueReportData {
  query: RevenueReportQuery;
  summary: RevenueReportSummary;
  byAirline: RevenueReportBreakdownRow[];
  byAgent: RevenueReportBreakdownRow[];
  byPaymentMethod: RevenueReportBreakdownRow[];
  timeline: RevenueTimelinePoint[];
  bookingRows: RevenueReportBookingRow[];
  paymentRows: RevenueReportPaymentRow[];
}

type BookingReportModel = Prisma.BookingGetPayload<{
  include: {
    customer: {
      select: {
        fullName: true;
      };
    };
    createdBy: {
      select: {
        email: true;
      };
    };
    payments: {
      select: {
        id: true;
        amount: true;
        status: true;
        method: true;
        paidAt: true;
      };
    };
  };
}>;

type PaymentReportModel = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        customer: {
          select: {
            fullName: true;
          };
        };
        createdBy: {
          select: {
            email: true;
          };
        };
      };
    };
  };
}>;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function todayDateKey(): string {
  return localDateKey(new Date());
}

function firstDayOfMonthKey(): string {
  const now = new Date();
  return localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+07:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(value: Date): string {
  return localDateKey(value);
}

export function buildTimeline(from: string, to: string): Map<string, RevenueTimelinePoint> {
  const timeline = new Map<string, RevenueTimelinePoint>();
  let cursor = startOfDay(from);
  const deadline = endOfDay(to);

  while (cursor.getTime() <= deadline.getTime()) {
    const key = dateKey(cursor);
    timeline.set(key, {
      date: key,
      bookingCount: 0,
      grossSale: 0,
      profit: 0,
      collected: 0,
      refunded: 0,
      netCashIn: 0,
    });
    cursor = addDays(cursor, 1);
  }

  return timeline;
}

export function sumPaymentFlows(
  payments: Array<{ amount: number; status: PaymentStatus }>,
): { collected: number; refunded: number; netCashIn: number } {
  return payments.reduce(
    (summary, payment) => {
      if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL) {
        summary.collected += payment.amount;
        summary.netCashIn += payment.amount;
      }

      if (payment.status === PaymentStatus.REFUNDED) {
        summary.refunded += Math.abs(payment.amount);
        summary.netCashIn += payment.amount;
      }

      return summary;
    },
    { collected: 0, refunded: 0, netCashIn: 0 },
  );
}

const MAX_REVENUE_RANGE_DAYS = 366;

export function normalizeRevenueReportQuery(input: z.input<typeof revenueReportQuerySchema>): RevenueReportQuery {
  const parsed = revenueReportQuerySchema.parse(input);
  const to = parsed.to ?? todayDateKey();
  let from = parsed.from ?? firstDayOfMonthKey();

  // Totals/breakdowns are aggregated in-memory over the full result set, so capping rows
  // would corrupt the figures. Bound the date window instead to limit how much we load.
  const earliestFrom = localDateKey(addDays(startOfDay(to), -MAX_REVENUE_RANGE_DAYS));
  if (from < earliestFrom) {
    from = earliestFrom;
  }

  return {
    ...parsed,
    from,
    to,
  };
}

function buildBookingWhere(query: RevenueReportQuery, ctx: OwnershipContext): Prisma.BookingWhereInput {
  const baseWhere: Prisma.BookingWhereInput = {
    ...(query.airline ? { airline: query.airline.toUpperCase() } : {}),
    ...(query.agentId ? { createdById: query.agentId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  return bookingListWhereForRole(ctx, baseWhere);
}

function paymentMethodFilter(query: RevenueReportQuery): Prisma.PaymentWhereInput {
  return query.paymentMethod ? { method: query.paymentMethod } : {};
}

function aggregateBreakdown<T extends string>(
  keys: T[],
  build: (key: T) => RevenueReportBreakdownRow | null,
): RevenueReportBreakdownRow[] {
  return keys
    .map(build)
    .filter((item): item is RevenueReportBreakdownRow => item !== null)
    .sort((left, right) => right.netCashIn - left.netCashIn || right.grossSale - left.grossSale || right.bookingCount - left.bookingCount);
}

function summarizeBookingRows(rows: RevenueReportBookingRow[]): RevenueReportSummary {
  return rows.reduce(
    (summary, row) => {
      summary.bookingCount += 1;
      if (row.status === BookingStatus.TICKETED) {
        summary.ticketedCount += 1;
      }
      summary.paymentCount += row.paymentCount;
      summary.grossSale += row.grossSale;
      summary.netAmount += row.netAmount;
      summary.markupAmount += row.markupAmount;
      summary.serviceFeeAmount += row.serviceFeeAmount;
      summary.profit += row.profit;
      summary.collected += row.collected;
      summary.refunded += row.refunded;
      summary.netCashIn += row.collected - row.refunded;
      summary.outstanding += row.outstanding;
      return summary;
    },
    {
      bookingCount: 0,
      ticketedCount: 0,
      paymentCount: 0,
      grossSale: 0,
      netAmount: 0,
      markupAmount: 0,
      serviceFeeAmount: 0,
      profit: 0,
      collected: 0,
      refunded: 0,
      netCashIn: 0,
      outstanding: 0,
    } satisfies RevenueReportSummary,
  );
}

function summarizePaymentRows(rows: RevenueReportPaymentRow[], bookingRows: RevenueReportBookingRow[]): RevenueReportSummary {
  const bookingSummary = summarizeBookingRows(bookingRows);

  return rows.reduce(
    (summary, row) => {
      summary.paymentCount += 1;
      summary.collected += row.collected;
      summary.refunded += row.refunded;
      summary.netCashIn += row.netCashIn;
      return summary;
    },
    {
      ...bookingSummary,
      paymentCount: 0,
      collected: 0,
      refunded: 0,
      netCashIn: 0,
    },
  );
}

function bookingRowsToBreakdowns(rows: RevenueReportBookingRow[]) {
  const airlineKeys = Array.from(new Set(rows.map((row) => row.airline || "N/A")));
  const agentKeys = Array.from(new Set(rows.map((row) => row.createdByEmail || "system")));

  return {
    byAirline: aggregateBreakdown(airlineKeys, (key) => {
      const scoped = rows.filter((row) => (row.airline || "N/A") === key);

      if (scoped.length === 0) {
        return null;
      }

      return {
        key,
        bookingCount: scoped.length,
        paymentCount: scoped.reduce((sum, row) => sum + row.paymentCount, 0),
        grossSale: scoped.reduce((sum, row) => sum + row.grossSale, 0),
        profit: scoped.reduce((sum, row) => sum + row.profit, 0),
        collected: scoped.reduce((sum, row) => sum + row.collected, 0),
        refunded: scoped.reduce((sum, row) => sum + row.refunded, 0),
        netCashIn: scoped.reduce((sum, row) => sum + row.collected - row.refunded, 0),
      };
    }),
    byAgent: aggregateBreakdown(agentKeys, (key) => {
      const scoped = rows.filter((row) => (row.createdByEmail || "system") === key);

      if (scoped.length === 0) {
        return null;
      }

      return {
        key,
        bookingCount: scoped.length,
        paymentCount: scoped.reduce((sum, row) => sum + row.paymentCount, 0),
        grossSale: scoped.reduce((sum, row) => sum + row.grossSale, 0),
        profit: scoped.reduce((sum, row) => sum + row.profit, 0),
        collected: scoped.reduce((sum, row) => sum + row.collected, 0),
        refunded: scoped.reduce((sum, row) => sum + row.refunded, 0),
        netCashIn: scoped.reduce((sum, row) => sum + row.collected - row.refunded, 0),
      };
    }),
  };
}

function paymentRowsToMethodBreakdown(rows: RevenueReportPaymentRow[]) {
  const methods = Array.from(new Set(rows.map((row) => row.method)));

  return aggregateBreakdown(methods, (key) => {
    const scoped = rows.filter((row) => row.method === key);

    if (scoped.length === 0) {
      return null;
    }

    return {
      key,
      bookingCount: new Set(scoped.map((row) => row.bookingId)).size,
      paymentCount: scoped.length,
      grossSale: 0,
      profit: 0,
      collected: scoped.reduce((sum, row) => sum + row.collected, 0),
      refunded: scoped.reduce((sum, row) => sum + row.refunded, 0),
      netCashIn: scoped.reduce((sum, row) => sum + row.netCashIn, 0),
    };
  });
}

async function loadBookingsForMode(
  query: RevenueReportQuery,
  ctx: OwnershipContext,
): Promise<{ bookingRows: RevenueReportBookingRow[]; paymentRows: RevenueReportPaymentRow[]; timeline: RevenueTimelinePoint[] }> {
  const bookingWhere = buildBookingWhere(query, ctx);
  const timelineMap = buildTimeline(query.from, query.to);

  if (query.mode === "PAYMENT_DATE") {
    const payments = await prisma.payment.findMany({
      where: {
        ...paymentMethodFilter(query),
        ...(query.from || query.to
          ? {
              paidAt: {
                gte: startOfDay(query.from),
                lte: endOfDay(query.to),
              },
            }
          : {}),
        booking: bookingWhere,
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true } },
            createdBy: { select: { email: true } },
          },
        },
      },
    }) as PaymentReportModel[];

    const bookingIds = Array.from(new Set(payments.map((payment) => payment.bookingId)));
    const touchedBookings = bookingIds.length
      ? await prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          include: {
            customer: { select: { fullName: true } },
            createdBy: { select: { email: true } },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                method: true,
                paidAt: true,
              },
            },
          },
        })
      : [];
    const bookingMap = new Map(touchedBookings.map((booking) => [booking.id, booking]));

    const paymentRows = payments.map((payment) => {
      const collected =
        payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL
          ? payment.amount
          : 0;
      const refunded = payment.status === PaymentStatus.REFUNDED ? Math.abs(payment.amount) : 0;
      const netCashIn = payment.status === PaymentStatus.REFUNDED ? payment.amount : collected;
      const timelinePoint = payment.paidAt ? timelineMap.get(dateKey(payment.paidAt)) : null;

      if (timelinePoint) {
        timelinePoint.collected += collected;
        timelinePoint.refunded += refunded;
        timelinePoint.netCashIn += netCashIn;
      }

      return {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        pnr: payment.booking.pnr,
        airline: payment.booking.airline,
        route: payment.booking.routeSummary,
        customerName: payment.booking.customer?.fullName ?? null,
        createdByEmail: payment.booking.createdBy?.email ?? null,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        amount: payment.amount,
        collected,
        refunded,
        netCashIn,
      };
    });

    const bookingRows = touchedBookings.map((booking) => {
      const paymentFlow = sumPaymentFlows(booking.payments);
      const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);

      return {
        bookingId: booking.id,
        pnr: booking.pnr,
        status: booking.status,
        airline: booking.airline,
        route: booking.routeSummary,
        customerName: booking.customer?.fullName ?? null,
        createdByEmail: booking.createdBy?.email ?? null,
        modeDate: null,
        grossSale: booking.saleAmount,
        netAmount: booking.netAmount,
        markupAmount: booking.markupAmount,
        serviceFeeAmount: booking.serviceFeeAmount,
        profit: booking.profit,
        collected: paymentFlow.collected,
        refunded: paymentFlow.refunded,
        outstanding: paymentSummary.balance,
        paymentCount: booking.payments.length,
      };
    });

    return {
      bookingRows,
      paymentRows,
      timeline: Array.from(timelineMap.values()),
    };
  }

  const issueDates = new Map<string, Date>();
  let bookingIds: string[] | null = null;

  if (query.mode === "ISSUE_DATE") {
    const issueEvents = await prisma.bookingTimelineEvent.findMany({
      where: {
        eventType: "TICKET_ISSUED",
        occurredAt: {
          gte: startOfDay(query.from),
          lte: endOfDay(query.to),
        },
        booking: bookingWhere,
      },
      orderBy: { occurredAt: "asc" },
    });

    for (const event of issueEvents) {
      if (!issueDates.has(event.bookingId)) {
        issueDates.set(event.bookingId, event.occurredAt);
      }
    }

    bookingIds = Array.from(issueDates.keys());
  }

  const bookings = await prisma.booking.findMany({
    where:
      query.mode === "BOOKING_DATE"
        ? {
            ...bookingWhere,
            createdAt: {
              gte: startOfDay(query.from),
              lte: endOfDay(query.to),
            },
          }
        : {
            id: { in: bookingIds ?? [] },
          },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { fullName: true } },
      createdBy: { select: { email: true } },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          paidAt: true,
        },
      },
    },
  }) as BookingReportModel[];

  const bookingRows = bookings.map((booking) => {
    const paymentFlow = sumPaymentFlows(booking.payments);
    const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);
    const modeDateValue = query.mode === "ISSUE_DATE" ? issueDates.get(booking.id) ?? null : booking.createdAt;
    const timelinePoint = modeDateValue ? timelineMap.get(dateKey(modeDateValue)) : null;

    if (timelinePoint) {
      timelinePoint.bookingCount += 1;
      timelinePoint.grossSale += booking.saleAmount;
      timelinePoint.profit += booking.profit;
      timelinePoint.collected += paymentFlow.collected;
      timelinePoint.refunded += paymentFlow.refunded;
      timelinePoint.netCashIn += paymentFlow.collected - paymentFlow.refunded;
    }

    return {
      bookingId: booking.id,
      pnr: booking.pnr,
      status: booking.status,
      airline: booking.airline,
      route: booking.routeSummary,
      customerName: booking.customer?.fullName ?? null,
      createdByEmail: booking.createdBy?.email ?? null,
      modeDate: modeDateValue?.toISOString() ?? null,
      grossSale: booking.saleAmount,
      netAmount: booking.netAmount,
      markupAmount: booking.markupAmount,
      serviceFeeAmount: booking.serviceFeeAmount,
      profit: booking.profit,
      collected: paymentFlow.collected,
      refunded: paymentFlow.refunded,
      outstanding: paymentSummary.balance,
      paymentCount: booking.payments.length,
    };
  });

  const paymentRows = bookings.flatMap((booking) =>
    booking.payments.map((payment) => ({
      paymentId: payment.id,
      bookingId: booking.id,
      pnr: booking.pnr,
      airline: booking.airline,
      route: booking.routeSummary,
      customerName: booking.customer?.fullName ?? null,
      createdByEmail: booking.createdBy?.email ?? null,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      amount: payment.amount,
      collected:
        payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL
          ? payment.amount
          : 0,
      refunded: payment.status === PaymentStatus.REFUNDED ? Math.abs(payment.amount) : 0,
      netCashIn:
        payment.status === PaymentStatus.REFUNDED
          ? payment.amount
          : payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL
            ? payment.amount
            : 0,
    })),
  );

  return {
    bookingRows,
    paymentRows,
    timeline: Array.from(timelineMap.values()),
  };
}

export async function getRevenueReportData(
  rawQuery: z.input<typeof revenueReportQuerySchema>,
  ctx: OwnershipContext,
): Promise<RevenueReportData> {
  const query = normalizeRevenueReportQuery(rawQuery);
  const { bookingRows, paymentRows, timeline } = await loadBookingsForMode(query, ctx);
  const summary =
    query.mode === "PAYMENT_DATE"
      ? summarizePaymentRows(paymentRows, bookingRows)
      : summarizeBookingRows(bookingRows);
  const bookingBreakdowns = bookingRowsToBreakdowns(bookingRows);

  return {
    query,
    summary,
    byAirline: bookingBreakdowns.byAirline,
    byAgent: bookingBreakdowns.byAgent,
    byPaymentMethod: paymentRowsToMethodBreakdown(paymentRows),
    timeline,
    bookingRows,
    paymentRows,
  };
}
