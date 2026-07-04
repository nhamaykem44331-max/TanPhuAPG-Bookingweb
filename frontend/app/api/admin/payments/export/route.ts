import { PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { csvResponse } from "@/lib/export/csv";
import { excelResponse } from "@/lib/export/excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYMENT_EXPORT_ROLES = ["SUPER_ADMIN", "QUAN_LY_DAI_LY", "KE_TOAN"] as const;
const querySchema = z.object({
  bookingId: z.string().cuid().optional(),
  status: z.enum(Object.values(PaymentStatus) as [PaymentStatus, ...PaymentStatus[]]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+07:00`);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function validationError(error: z.ZodError) {
  return NextResponse.json({ error: "VALIDATION_ERROR", fieldErrors: error.flatten().fieldErrors }, { status: 422 });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole([...PAYMENT_EXPORT_ROLES]);
    const parsed = querySchema.safeParse({
      bookingId: request.nextUrl.searchParams.get("bookingId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      format: request.nextUrl.searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const payments = await prisma.payment.findMany({
      where: {
        ...(parsed.data.bookingId ? { bookingId: parsed.data.bookingId } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.from || parsed.data.to
          ? {
              createdAt: {
                ...(parsed.data.from ? { gte: startOfDay(parsed.data.from) } : {}),
                ...(parsed.data.to ? { lte: endOfDay(parsed.data.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
      include: {
        booking: { select: { pnr: true } },
        receivedBy: { select: { email: true } },
      },
    });
    const headers = ["id", "bookingId", "bookingPnr", "method", "amount", "status", "paidAt", "transactionRef", "receivedByEmail", "notes", "createdAt"];
    const rows = payments.map((payment) => [
      payment.id,
      payment.bookingId,
      payment.booking.pnr,
      payment.method,
      payment.amount,
      payment.status,
      payment.paidAt?.toISOString() ?? "",
      payment.transactionRef,
      payment.receivedBy?.email ?? "",
      payment.notes,
      payment.createdAt.toISOString(),
    ]);
    const filename = `payments_${dateStamp()}.${parsed.data.format}`;

    return parsed.data.format === "xlsx"
      ? excelResponse(filename, "Payments", headers, rows)
      : csvResponse(filename, headers, rows);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
