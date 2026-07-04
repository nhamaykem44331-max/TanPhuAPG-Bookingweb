import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { listAdminBookings } from "@/lib/bookings/admin";
import { adminBookingListQuerySchema } from "@/lib/bookings/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(ADMIN_ROLES);

    const parsedQuery = adminBookingListQuerySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      pnr: request.nextUrl.searchParams.get("pnr") ?? undefined,
      orderCode: request.nextUrl.searchParams.get("orderCode") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fieldErrors: parsedQuery.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const result = await listAdminBookings(parsedQuery.data, {
      userId: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json({
      items: result.items,
      total: result.total,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
