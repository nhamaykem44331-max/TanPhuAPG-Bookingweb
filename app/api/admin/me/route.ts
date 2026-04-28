import { NextResponse } from "next/server";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireRole(ADMIN_ROLES);

    return NextResponse.json({
      user: session.user,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
