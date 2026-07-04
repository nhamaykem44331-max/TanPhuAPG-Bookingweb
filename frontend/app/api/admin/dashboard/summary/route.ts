import { NextResponse } from "next/server";

import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { getDashboardSummary } from "@/lib/dashboard/query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireRole(DASHBOARD_VIEWER_ROLES);
    const data = await getDashboardSummary({
      userId: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
