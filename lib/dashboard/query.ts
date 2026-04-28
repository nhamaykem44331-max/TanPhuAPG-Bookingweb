import { BookingStatus, type Prisma } from "@prisma/client";

import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { bookingListWhereForRole, type OwnershipContext } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db";
import { getDashboardCache, setDashboardCache } from "@/lib/dashboard/cache";

export interface DashboardSummary {
  today: {
    bookingCount: number;
    bookingCountYesterday: number;
    deltaPercent: number;
  };
  week: {
    saleAmount: number;
    count: number;
  };
  month: {
    profit: number;
    bookingCount: number;
  };
  outstanding: {
    balance: number;
    bookingCount: number;
  };
  byAirline: Array<{
    airline: string;
    count: number;
    netAmount: number;
    markup: number;
    profit: number;
  }>;
  byAgent: Array<{
    actorId: string | null;
    email: string;
    count: number;
    sellAmount: number;
    profit: number;
  }>;
  revenue30d: Array<{
    date: string;
    sale: number;
    profit: number;
  }>;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function whereFor(ctx: OwnershipContext, where: Prisma.BookingWhereInput): Prisma.BookingWhereInput {
  return bookingListWhereForRole(ctx, where);
}

function deltaPercent(today: number, yesterday: number): number {
  if (yesterday === 0) {
    return today === 0 ? 0 : 100;
  }

  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

export async function getDashboardSummary(ctx: OwnershipContext): Promise<DashboardSummary> {
  const cacheKey = `${ctx.userId}:${ctx.role}`;
  const cached = getDashboardCache<DashboardSummary>(cacheKey);

  if (cached) {
    return cached;
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const revenueStart = addDays(todayStart, -29);
  const activeStatuses: BookingStatus[] = [BookingStatus.HELD, BookingStatus.TICKETED];

  const [
    todayCount,
    yesterdayCount,
    weekAggregate,
    weekCount,
    monthAggregate,
    monthCount,
    outstandingBookings,
    airlineRows,
    agentRows,
    revenueBookings,
  ] = await Promise.all([
    prisma.booking.count({
      where: whereFor(ctx, { createdAt: { gte: todayStart, lt: tomorrowStart } }),
    }),
    prisma.booking.count({
      where: whereFor(ctx, { createdAt: { gte: yesterdayStart, lt: todayStart } }),
    }),
    prisma.booking.aggregate({
      where: whereFor(ctx, { status: { in: activeStatuses }, createdAt: { gte: weekStart } }),
      _sum: { saleAmount: true },
    }),
    prisma.booking.count({
      where: whereFor(ctx, { status: { in: activeStatuses }, createdAt: { gte: weekStart } }),
    }),
    prisma.booking.aggregate({
      where: whereFor(ctx, { status: BookingStatus.TICKETED, createdAt: { gte: monthStart } }),
      _sum: { profit: true },
    }),
    prisma.booking.count({
      where: whereFor(ctx, { status: BookingStatus.TICKETED, createdAt: { gte: monthStart } }),
    }),
    prisma.booking.findMany({
      where: whereFor(ctx, { status: { in: activeStatuses } }),
      select: {
        saleAmount: true,
        payments: {
          select: {
            amount: true,
            status: true,
          },
        },
      },
    }),
    prisma.booking.groupBy({
      by: ["airline"],
      where: whereFor(ctx, { status: { in: activeStatuses } }),
      _count: { _all: true },
      _sum: {
        netAmount: true,
        markupAmount: true,
        profit: true,
      },
      orderBy: {
        _sum: {
          profit: "desc",
        },
      },
      take: 10,
    }),
    prisma.booking.groupBy({
      by: ["createdById"],
      where: whereFor(ctx, { status: { in: activeStatuses } }),
      _count: { _all: true },
      _sum: {
        saleAmount: true,
        profit: true,
      },
      orderBy: {
        _sum: {
          saleAmount: "desc",
        },
      },
      take: 10,
    }),
    prisma.booking.findMany({
      where: whereFor(ctx, { status: { in: activeStatuses }, createdAt: { gte: revenueStart, lt: tomorrowStart } }),
      select: {
        createdAt: true,
        saleAmount: true,
        profit: true,
        status: true,
      },
    }),
  ]);

  const outstanding = outstandingBookings.reduce(
    (summary, booking) => {
      const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);

      if (paymentSummary.balance <= 0) {
        return summary;
      }

      return {
        balance: summary.balance + paymentSummary.balance,
        bookingCount: summary.bookingCount + 1,
      };
    },
    { balance: 0, bookingCount: 0 },
  );
  const agentIds = agentRows.map((row) => row.createdById).filter((id): id is string => !!id);
  const users = agentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const revenueMap = new Map<string, { sale: number; profit: number }>();

  for (let index = 0; index < 30; index += 1) {
    revenueMap.set(formatDateKey(addDays(revenueStart, index)), { sale: 0, profit: 0 });
  }

  for (const booking of revenueBookings) {
    const key = formatDateKey(booking.createdAt);
    const current = revenueMap.get(key) ?? { sale: 0, profit: 0 };
    current.sale += booking.saleAmount;
    current.profit += booking.status === BookingStatus.TICKETED ? booking.profit : 0;
    revenueMap.set(key, current);
  }

  const summary: DashboardSummary = {
    today: {
      bookingCount: todayCount,
      bookingCountYesterday: yesterdayCount,
      deltaPercent: deltaPercent(todayCount, yesterdayCount),
    },
    week: {
      saleAmount: weekAggregate._sum.saleAmount ?? 0,
      count: weekCount,
    },
    month: {
      profit: monthAggregate._sum.profit ?? 0,
      bookingCount: monthCount,
    },
    outstanding,
    byAirline: airlineRows.map((row) => ({
      airline: row.airline ?? "N/A",
      count: row._count._all,
      netAmount: row._sum.netAmount ?? 0,
      markup: row._sum.markupAmount ?? 0,
      profit: row._sum.profit ?? 0,
    })),
    byAgent: agentRows.map((row) => ({
      actorId: row.createdById,
      email: row.createdById ? emailById.get(row.createdById) ?? "unknown" : "system",
      count: row._count._all,
      sellAmount: row._sum.saleAmount ?? 0,
      profit: row._sum.profit ?? 0,
    })),
    revenue30d: Array.from(revenueMap.entries()).map(([date, value]) => ({
      date,
      sale: value.sale,
      profit: value.profit,
    })),
  };

  setDashboardCache(cacheKey, summary);
  return summary;
}
