import { NextRequest, NextResponse } from "next/server";

import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { funnelQuerySchema, getFunnel } from "@/lib/bookings/opsAggregation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(DASHBOARD_VIEWER_ROLES);
    const parsed = funnelQuerySchema.safeParse({
      range: request.nextUrl.searchParams.get("range") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const funnel = await getFunnel(parsed.data);
    return NextResponse.json(funnel);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
