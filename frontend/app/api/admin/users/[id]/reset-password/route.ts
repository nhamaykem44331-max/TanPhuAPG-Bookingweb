import { NextResponse } from "next/server";

import { getAuditRequestMeta } from "@/lib/audit";
import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { AdminUserError, resetAdminUserPassword } from "@/lib/users/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function userError(error: AdminUserError) {
  return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
}

export async function POST(_: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(USER_MANAGER_ROLES);
    return NextResponse.json(await resetAdminUserPassword(context.params.id, session.user.id, getAuditRequestMeta()));
  } catch (error) {
    if (error instanceof AdminUserError) {
      return userError(error);
    }

    return toAdminErrorResponse(error);
  }
}
