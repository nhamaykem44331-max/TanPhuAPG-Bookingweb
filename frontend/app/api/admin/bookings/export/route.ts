import { BookingStatus, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { bookingListWhereForRole } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { csvResponse } from "@/lib/export/csv";
import { excelResponse } from "@/lib/export/excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  status: z.enum(Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orderCode: z.string().trim().max(40).optional(),
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
    const session = await requireRole(ADMIN_ROLES);
    const parsed = querySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      orderCode: request.nextUrl.searchParams.get("orderCode") ?? undefined,
      format: request.nextUrl.searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const baseWhere: Prisma.BookingWhereInput = {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.orderCode
        ? {
            orderCode: {
              contains: parsed.data.orderCode,
              mode: "insensitive",
            },
          }
        : {}),
      ...(parsed.data.from || parsed.data.to
        ? {
            departAt: {
              ...(parsed.data.from ? { gte: startOfDay(parsed.data.from) } : {}),
              ...(parsed.data.to ? { lte: endOfDay(parsed.data.to) } : {}),
            },
          }
        : {}),
    };
    const where = bookingListWhereForRole({ userId: session.user.id, role: session.user.role }, baseWhere);
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
      include: {
        customer: { select: { fullName: true, phone: true } },
        createdBy: { select: { email: true } },
      },
    });
    const headers = [
      "id",
      "orderCode",
      "pnr",
      "status",
      "airline",
      "route",
      "tripType",
      "departAt",
      "passengerCount",
      "customerName",
      "customerPhone",
      "netAmount",
      "markupAmount",
      "sellAmount",
      "profit",
      "currency",
      "createdBy",
      "createdAt",
      "ttlExpiresAt",
    ];
    const rows = bookings.map((booking) => [
      booking.id,
      booking.orderCode,
      booking.pnr,
      booking.status,
      booking.airline,
      booking.routeSummary,
      booking.tripType,
      booking.departAt?.toISOString() ?? "",
      booking.adt + booking.chd + booking.inf,
      booking.customer?.fullName ?? "",
      booking.customer?.phone ?? "",
      booking.netAmount,
      booking.markupAmount,
      booking.saleAmount,
      booking.profit,
      booking.currency,
      booking.createdBy?.email ?? "",
      booking.createdAt.toISOString(),
      booking.ttlExpiresAt?.toISOString() ?? "",
    ]);
    const filename = `bookings_${dateStamp()}.${parsed.data.format}`;

    return parsed.data.format === "xlsx"
      ? excelResponse(filename, "Bookings", headers, rows)
      : csvResponse(filename, headers, rows);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
