import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { AdminUserError, getAdminUserById, updateAdminUser } from "@/lib/users/admin";
import { adminUserPatchSchema } from "@/lib/users/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

function userError(error: AdminUserError) {
  return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    await requireRole(USER_MANAGER_ROLES);

    const user = await getAdminUserById(context.params.id);

    if (!user) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(USER_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = adminUserPatchSchema.safeParse(body);

    if (!parsedInput.success) {
      return validationError(parsedInput.error);
    }

    return NextResponse.json(await updateAdminUser(context.params.id, parsedInput.data, session.user.id, getAuditRequestMeta()));
  } catch (error) {
    if (error instanceof AdminUserError) {
      return userError(error);
    }

    return toAdminErrorResponse(error);
  }
}
