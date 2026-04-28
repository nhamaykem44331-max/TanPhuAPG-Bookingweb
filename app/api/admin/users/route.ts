import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { AdminUserError, createAdminUser, listAdminUsers } from "@/lib/users/admin";
import { adminUserCreateSchema, adminUserListQuerySchema } from "@/lib/users/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

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

export async function GET(request: NextRequest) {
  try {
    await requireRole(USER_MANAGER_ROLES);

    const parsedQuery = adminUserListQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      role: request.nextUrl.searchParams.get("role") ?? undefined,
      active: parseBooleanParam(request.nextUrl.searchParams.get("active")),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return validationError(parsedQuery.error);
    }

    return NextResponse.json(await listAdminUsers(parsedQuery.data));
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(USER_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = adminUserCreateSchema.safeParse(body);

    if (!parsedInput.success) {
      return validationError(parsedInput.error);
    }

    const result = await createAdminUser(parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return userError(error);
    }

    return toAdminErrorResponse(error);
  }
}
