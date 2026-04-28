import { NextResponse } from "next/server";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { assertCanViewBooking } from "@/lib/auth/ownership";
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
    await assertCanViewBooking({ userId: session.user.id, role: session.user.role }, params.id);

    const detail = await getAdminBookingById(params.id);

    if (!detail) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
