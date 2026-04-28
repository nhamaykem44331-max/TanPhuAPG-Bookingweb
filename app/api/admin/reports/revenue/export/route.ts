import { NextRequest, NextResponse } from "next/server";

import { REVENUE_REPORT_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { csvResponse } from "@/lib/export/csv";
import { excelResponse } from "@/lib/export/excel";
import { getRevenueReportData, revenueReportQuerySchema } from "@/lib/reports/revenue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(REVENUE_REPORT_ROLES);
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    const parsed = revenueReportQuerySchema.safeParse({
      mode: request.nextUrl.searchParams.get("mode") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      airline: request.nextUrl.searchParams.get("airline") ?? undefined,
      agentId: request.nextUrl.searchParams.get("agentId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      paymentMethod: request.nextUrl.searchParams.get("paymentMethod") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json({ error: "VALIDATION_ERROR", fieldErrors: { format: ["format không hợp lệ"] } }, { status: 422 });
    }

    const report = await getRevenueReportData(parsed.data, {
      userId: session.user.id,
      role: session.user.role,
    });
    const filename = `revenue_${report.query.mode.toLowerCase()}_${dateStamp()}.${format}`;

    if (report.query.mode === "PAYMENT_DATE") {
      const headers = [
        "paymentId",
        "bookingId",
        "pnr",
        "airline",
        "route",
        "customerName",
        "createdByEmail",
        "method",
        "status",
        "paidAt",
        "amount",
        "collected",
        "refunded",
        "netCashIn",
      ];
      const rows = report.paymentRows.map((row) => [
        row.paymentId,
        row.bookingId,
        row.pnr,
        row.airline,
        row.route,
        row.customerName,
        row.createdByEmail,
        row.method,
        row.status,
        row.paidAt,
        row.amount,
        row.collected,
        row.refunded,
        row.netCashIn,
      ]);

      return format === "xlsx"
        ? excelResponse(filename, "RevenuePayments", headers, rows)
        : csvResponse(filename, headers, rows);
    }

    const headers = [
      "bookingId",
      "pnr",
      "status",
      "airline",
      "route",
      "customerName",
      "createdByEmail",
      "modeDate",
      "grossSale",
      "netAmount",
      "markupAmount",
      "serviceFeeAmount",
      "profit",
      "collected",
      "refunded",
      "outstanding",
      "paymentCount",
    ];
    const rows = report.bookingRows.map((row) => [
      row.bookingId,
      row.pnr,
      row.status,
      row.airline,
      row.route,
      row.customerName,
      row.createdByEmail,
      row.modeDate,
      row.grossSale,
      row.netAmount,
      row.markupAmount,
      row.serviceFeeAmount,
      row.profit,
      row.collected,
      row.refunded,
      row.outstanding,
      row.paymentCount,
    ]);

    return format === "xlsx"
      ? excelResponse(filename, "RevenueBookings", headers, rows)
      : csvResponse(filename, headers, rows);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
