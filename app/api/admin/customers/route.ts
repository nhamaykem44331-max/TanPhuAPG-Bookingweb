import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES, CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { createAdminCustomer, listAdminCustomers } from "@/lib/customers/admin";
import { adminCustomerInputSchema, adminCustomerListQuerySchema } from "@/lib/customers/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function buildValidationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(ADMIN_ROLES);

    const parsedQuery = adminCustomerListQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      blacklisted: parseBooleanParam(request.nextUrl.searchParams.get("blacklisted")),
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return buildValidationError(parsedQuery.error);
    }

    const result = await listAdminCustomers(parsedQuery.data);
    return NextResponse.json(result);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(CUSTOMER_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = adminCustomerInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationError(parsedInput.error);
    }

    const customer = await createAdminCustomer(parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
