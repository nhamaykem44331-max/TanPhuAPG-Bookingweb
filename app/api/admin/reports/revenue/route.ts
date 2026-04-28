import { NextRequest, NextResponse } from "next/server";

import { REVENUE_REPORT_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { getRevenueReportData, revenueReportQuerySchema } from "@/lib/reports/revenue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(REVENUE_REPORT_ROLES);
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

    const report = await getRevenueReportData(parsed.data, {
      userId: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json(report);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
