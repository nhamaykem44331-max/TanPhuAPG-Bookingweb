import type { Prisma } from "@prisma/client";
import {
  BankTransactionStatus,
  NotificationJobStatus,
  PaymentIntentProvider,
  PaymentIntentStatus,
} from "@prisma/client";
import { z } from "zod";

import type { OwnershipContext } from "@/lib/auth/ownership";
import { bookingListWhereForRole } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db";

export const adminPaymentOpsQuerySchema = z.object({
  pnr: z.string().trim().optional(),
  scope: z.enum(["manual_review", "active", "matched", "all"]).default("manual_review"),
  provider: z.enum(["all", "PAYOS", "SEPAY"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AdminPaymentOpsQuery = z.infer<typeof adminPaymentOpsQuerySchema>;

export interface AdminPaymentOpsSummary {
  activeIntentCount: number;
  manualReviewCount: number;
  matchedTodayCount: number;
  pendingReminderCount: number;
}

export interface AdminPaymentOpsIntent {
  id: string;
  bookingId: string;
  orderCode: string;
  pnr: string | null;
  customerName: string | null;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  providerOrderCode: string;
  paymentLinkId: string | null;
  checkoutUrl: string | null;
  qrCode: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdByEmail: string | null;
  matchedWebhookCount: number;
  manualReviewWebhookCount: number;
}

export interface AdminPaymentOpsTransaction {
  id: string;
  bookingId: string | null;
  orderCode: string | null;
  pnr: string | null;
  customerName: string | null;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  reference: string | null;
  providerOrderCode: string | null;
  paymentLinkId: string | null;
  paymentId: string | null;
  manualReviewReason: string | null;
  createdAt: string;
}

export interface AdminPaymentOpsResult {
  summary: AdminPaymentOpsSummary;
  intents: AdminPaymentOpsIntent[];
  transactions: AdminPaymentOpsTransaction[];
  totalTransactions: number;
  limit: number;
  offset: number;
}

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildBookingScope(ctx: OwnershipContext, searchText?: string): Prisma.BookingWhereInput {
  const baseWhere: Prisma.BookingWhereInput = searchText
    ? {
        OR: [
          { orderCode: { contains: searchText, mode: "insensitive" } },
          { pnr: { contains: searchText, mode: "insensitive" } },
          { pnrs: { some: { pnr: { contains: searchText, mode: "insensitive" } } } },
        ],
      }
    : {};

  return bookingListWhereForRole(ctx, baseWhere);
}

function buildIntentWhere(
  query: AdminPaymentOpsQuery,
  bookingWhere: Prisma.BookingWhereInput,
): Prisma.PaymentIntentWhereInput {
  const statusFilter =
    query.scope === "active"
      ? { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] }
      : query.scope === "manual_review"
        ? PaymentIntentStatus.MANUAL_REVIEW
        : undefined;

  const providerFilter =
    query.provider === "PAYOS"
      ? PaymentIntentProvider.PAYOS
      : query.provider === "SEPAY"
        ? PaymentIntentProvider.SEPAY
        : undefined;

  return {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(providerFilter ? { provider: providerFilter } : {}),
    booking: bookingWhere,
  };
}

function buildTransactionWhere(
  query: AdminPaymentOpsQuery,
  bookingWhere: Prisma.BookingWhereInput,
): Prisma.BankTransactionWhereInput {
  const statusFilter =
    query.scope === "matched"
      ? BankTransactionStatus.MATCHED
      : query.scope === "manual_review"
        ? BankTransactionStatus.MANUAL_REVIEW
        : undefined;

  const providerFilter =
    query.provider === "PAYOS"
      ? PaymentIntentProvider.PAYOS
      : query.provider === "SEPAY"
        ? PaymentIntentProvider.SEPAY
        : undefined;

  return {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(providerFilter ? { provider: providerFilter } : {}),
    paymentIntent: {
      is: {
        booking: bookingWhere,
      },
    },
  };
}

export async function listAdminPaymentOps(
  query: AdminPaymentOpsQuery,
  ctx: OwnershipContext,
): Promise<AdminPaymentOpsResult> {
  const bookingWhere = buildBookingScope(ctx, query.pnr);
  const intentWhere = buildIntentWhere(query, bookingWhere);
  const transactionWhere = buildTransactionWhere(query, bookingWhere);
  const today = todayStart();

  const [
    activeIntentCount,
    manualReviewCount,
    matchedTodayCount,
    pendingReminderCount,
    intents,
    transactions,
    totalTransactions,
  ] = await Promise.all([
    prisma.paymentIntent.count({
      where: {
        status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PARTIAL] },
        booking: buildBookingScope(ctx),
      },
    }),
    prisma.bankTransaction.count({
      where: {
        status: BankTransactionStatus.MANUAL_REVIEW,
        paymentIntent: {
          is: {
            booking: buildBookingScope(ctx),
          },
        },
      },
    }),
    prisma.bankTransaction.count({
      where: {
        status: BankTransactionStatus.MATCHED,
        createdAt: { gte: today },
        paymentIntent: {
          is: {
            booking: buildBookingScope(ctx),
          },
        },
      },
    }),
    prisma.notificationJob.count({
      where: {
        status: { in: [NotificationJobStatus.PENDING, NotificationJobStatus.PROCESSING] },
        booking: buildBookingScope(ctx),
      },
    }),
    prisma.paymentIntent.findMany({
      where: intentWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(query.limit, 20),
      include: {
        booking: {
          select: {
            id: true,
            orderCode: true,
            pnr: true,
            customer: {
              select: {
                fullName: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            email: true,
          },
        },
        bankTransactions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.bankTransaction.findMany({
      where: transactionWhere,
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        paymentIntent: {
          include: {
            booking: {
              select: {
                id: true,
                orderCode: true,
                pnr: true,
                customer: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.bankTransaction.count({
      where: transactionWhere,
    }),
  ]);

  return {
    summary: {
      activeIntentCount,
      manualReviewCount,
      matchedTodayCount,
      pendingReminderCount,
    },
    intents: intents.map((intent) => ({
      id: intent.id,
      bookingId: intent.bookingId,
      orderCode: intent.booking.orderCode,
      pnr: intent.booking.pnr,
      customerName: intent.booking.customer?.fullName ?? null,
      provider: intent.provider,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      providerOrderCode: intent.providerOrderCode,
      paymentLinkId: intent.paymentLinkId,
      checkoutUrl: intent.checkoutUrl,
      qrCode: intent.qrCode,
      expiresAt: intent.expiresAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      createdByEmail: intent.createdBy?.email ?? null,
      matchedWebhookCount: intent.bankTransactions.filter((item) => item.status === BankTransactionStatus.MATCHED).length,
      manualReviewWebhookCount: intent.bankTransactions.filter((item) => item.status === BankTransactionStatus.MANUAL_REVIEW).length,
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      bookingId: transaction.paymentIntent?.booking.id ?? null,
      orderCode: transaction.paymentIntent?.booking.orderCode ?? null,
      pnr: transaction.paymentIntent?.booking.pnr ?? null,
      customerName: transaction.paymentIntent?.booking.customer?.fullName ?? null,
      provider: transaction.provider,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      reference: transaction.reference,
      providerOrderCode: transaction.providerOrderCode,
      paymentLinkId: transaction.paymentLinkId,
      paymentId: transaction.paymentId,
      manualReviewReason: transaction.manualReviewReason,
      createdAt: transaction.createdAt.toISOString(),
    })),
    totalTransactions,
    limit: query.limit,
    offset: query.offset,
  };
}
