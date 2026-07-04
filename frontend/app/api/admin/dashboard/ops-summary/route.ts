import { NextResponse } from "next/server";

import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { getOpsSummary } from "@/lib/bookings/opsAggregation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole(DASHBOARD_VIEWER_ROLES);
    const summary = await getOpsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
