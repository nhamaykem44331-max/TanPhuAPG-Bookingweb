import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";
import { csvResponse } from "@/lib/export/csv";
import { excelResponse } from "@/lib/export/excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  blacklisted: z.boolean().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

function parseBoolean(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

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

function mergedIntoId(tags: Prisma.JsonValue | null): string {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return "";
  }

  const value = (tags as Record<string, unknown>).mergedIntoId;
  return typeof value === "string" ? value : "";
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(CUSTOMER_MANAGER_ROLES);
    const parsed = querySchema.safeParse({
      blacklisted: parseBoolean(request.nextUrl.searchParams.get("blacklisted")),
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      format: request.nextUrl.searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const customers = await prisma.customer.findMany({
      where: {
        ...(parsed.data.blacklisted !== undefined ? { blacklisted: parsed.data.blacklisted } : {}),
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
        _count: { select: { bookings: true } },
      },
    });
    const headers = ["id", "fullName", "phone", "email", "idNumber", "passport", "blacklisted", "bookingCount", "createdAt", "mergedIntoId"];
    const rows = customers.map((customer) => [
      customer.id,
      customer.fullName,
      customer.phone,
      customer.email,
      customer.idNumber,
      customer.passport,
      customer.blacklisted,
      customer._count.bookings,
      customer.createdAt.toISOString(),
      mergedIntoId(customer.tags),
    ]);
    const filename = `customers_${dateStamp()}.${parsed.data.format}`;

    return parsed.data.format === "xlsx"
      ? excelResponse(filename, "Customers", headers, rows)
      : csvResponse(filename, headers, rows);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
