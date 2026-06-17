import { NextResponse } from "next/server";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { getAdminBookingById } from "@/lib/bookings/admin";

interface BookingDetailRouteContext {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: BookingDetailRouteContext) {
  try {
    const session = await requireRole(ADMIN_ROLES);
    const detail = await getAdminBookingById(params.id);

    if (!detail) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Row-level ownership: NHAN_VIEN_BAN may only view bookings they created.
    if (session.user.role === "NHAN_VIEN_BAN" && detail.booking.createdById !== session.user.id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
