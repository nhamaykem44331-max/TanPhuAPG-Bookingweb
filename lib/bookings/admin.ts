import type { Prisma as PrismaNamespace } from "@prisma/client";

import { bookingListWhereForRole, type OwnershipContext } from "@/lib/auth/ownership";
import { calculatePaymentSummary, type PaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";
import { syncBookingOrderById, syncExpiredBookingOrders } from "@/lib/bookings/orderManagement";
import type { AdminBookingListQuery } from "@/lib/bookings/schemas";
import { syncExpiredPaymentIntentsForBooking } from "@/lib/payments/paymentIntentService";

export interface AdminBookingRecord {
  id: string;
  orderCode: string;
  pnrRecordId: string;
  pnr: string;
  pnrStatus: string | null;
  status: string;
  airline: string | null;
  route: string;
  departureDate: string | null;
  passengerCount: number;
  netPrice: number;
  sellPrice: number;
  markupAmount: number;
  customerName: string | null;
  createdAt: string;
  holdExpiresAt: string | null;
}

export interface AdminBookingListResult {
  items: AdminBookingRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminBookingDetail {
  booking: AdminBookingCore;
  customer: AdminBookingCustomer;
  pnrs: AdminBookingPnr[];
  timeline: AdminBookingTimelineEvent[];
  payments: AdminBookingPayment[];
  paymentIntents: AdminBookingPaymentIntent[];
  notificationJobs: AdminBookingNotificationJob[];
  appliedMarkupRule: AdminAppliedMarkupRule;
  paymentSummary: PaymentSummary;
}

export type AdminBookingDetailModel = PrismaNamespace.BookingGetPayload<{
  include: {
    customer: true;
    pnrs: {
      include: Record<string, never>;
    };
    timelineEvents: {
      include: Record<string, never>;
    };
    payments: {
      include: {
        receivedBy: {
          select: {
            id: true;
            fullName: true;
            email: true;
          };
        };
      };
    };
    paymentIntents: {
      include: {
        createdBy: {
          select: {
            id: true;
            fullName: true;
            email: true;
          };
        };
        payments: {
          select: {
            id: true;
            amount: true;
            currency: true;
            status: true;
            paidAt: true;
            transactionRef: true;
          };
        };
        bankTransactions: {
          select: {
            id: true;
            amount: true;
            status: true;
            reference: true;
            manualReviewReason: true;
            createdAt: true;
            paymentId: true;
          };
        };
      };
    };
    notificationJobs: {
      include: Record<string, never>;
    };
    appliedMarkupRule: true;
  };
}>;

export type AdminBookingCore = Omit<
  AdminBookingDetailModel,
  "customer" | "pnrs" | "timelineEvents" | "payments" | "paymentIntents" | "notificationJobs" | "appliedMarkupRule"
>;
export type AdminBookingCustomer = AdminBookingDetailModel["customer"];
export type AdminBookingPnr = AdminBookingDetailModel["pnrs"][number];
export type AdminBookingTimelineEvent = AdminBookingDetailModel["timelineEvents"][number];
export type AdminBookingPayment = AdminBookingDetailModel["payments"][number];
export type AdminBookingPaymentIntent = AdminBookingDetailModel["paymentIntents"][number];
export type AdminBookingNotificationJob = AdminBookingDetailModel["notificationJobs"][number];
export type AdminAppliedMarkupRule = AdminBookingDetailModel["appliedMarkupRule"];

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+07:00`);
}

type AdminBookingListItemModel = PrismaNamespace.BookingPnrGetPayload<{
  include: {
    booking: {
      include: {
        customer: {
          select: {
            fullName: true;
          };
        };
      };
    };
  };
}>;

function toAdminBookingRecord(pnr: AdminBookingListItemModel): AdminBookingRecord {
  return {
    id: pnr.booking.id,
    orderCode: pnr.booking.orderCode,
    pnrRecordId: pnr.id,
    pnr: pnr.pnr,
    pnrStatus: pnr.status,
    status: pnr.booking.status,
    airline: pnr.airline ?? pnr.booking.airline,
    route: pnr.routeSummary ?? pnr.booking.routeSummary,
    departureDate: (pnr.departAt ?? pnr.booking.departAt)?.toISOString() ?? null,
    passengerCount: pnr.booking.adt + pnr.booking.chd + pnr.booking.inf,
    netPrice: pnr.booking.netAmount,
    sellPrice: pnr.booking.saleAmount,
    markupAmount: pnr.booking.markupAmount,
    customerName: pnr.booking.customer?.fullName ?? null,
    createdAt: pnr.booking.createdAt.toISOString(),
    holdExpiresAt: (pnr.timelimit ?? pnr.booking.ttlExpiresAt)?.toISOString() ?? null,
  };
}

export async function listAdminBookings(query: AdminBookingListQuery, ownership?: OwnershipContext): Promise<AdminBookingListResult> {
  await syncExpiredBookingOrders();

  const bookingBaseWhere: PrismaNamespace.BookingWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.orderCode
      ? {
          orderCode: {
            contains: query.orderCode,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };
  const scopedBookingWhere = ownership ? bookingListWhereForRole(ownership, bookingBaseWhere) : bookingBaseWhere;
  const departureRange =
    query.from || query.to
      ? {
          ...(query.from ? { gte: startOfDay(query.from) } : {}),
          ...(query.to ? { lte: endOfDay(query.to) } : {}),
        }
      : null;
  const where: PrismaNamespace.BookingPnrWhereInput = {
    AND: [
      query.pnr
        ? {
            pnr: {
              contains: query.pnr,
              mode: "insensitive" as const,
            },
          }
        : {},
      departureRange
        ? {
            OR: [
              { departAt: departureRange },
              { departAt: null, booking: { departAt: departureRange } },
            ],
          }
        : {},
      { booking: scopedBookingWhere },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.bookingPnr.findMany({
      where,
      orderBy: [{ booking: { createdAt: "desc" } }, { createdAt: "asc" }],
      skip: query.offset,
      take: query.limit,
      include: {
        booking: {
          include: {
            customer: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    }),
    prisma.bookingPnr.count({ where }),
  ]);

  return {
    items: items.map(toAdminBookingRecord),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAdminBookingById(bookingId: string): Promise<AdminBookingDetail | null> {
  await syncBookingOrderById(bookingId);
  await syncExpiredPaymentIntentsForBooking(bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      pnrs: {
        orderBy: [{ departAt: "asc" }, { createdAt: "asc" }],
      },
      timelineEvents: {
        orderBy: { occurredAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: {
          receivedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      paymentIntents: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              paidAt: true,
              transactionRef: true,
            },
          },
          bankTransactions: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              status: true,
              reference: true,
              manualReviewReason: true,
              createdAt: true,
              paymentId: true,
            },
          },
        },
      },
      notificationJobs: {
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
        take: 12,
      },
      appliedMarkupRule: true,
    },
  });

  if (!booking) {
    return null;
  }

  const { customer, pnrs, timelineEvents, payments, paymentIntents, notificationJobs, appliedMarkupRule, ...bookingCore } = booking;

  return {
    booking: bookingCore,
    customer,
    pnrs,
    timeline: timelineEvents,
    payments,
    paymentIntents,
    notificationJobs,
    appliedMarkupRule,
    paymentSummary: calculatePaymentSummary(
      payments.map((payment) => ({
        amount: payment.amount,
        status: payment.status,
      })),
      bookingCore.saleAmount,
    ),
  };
}
