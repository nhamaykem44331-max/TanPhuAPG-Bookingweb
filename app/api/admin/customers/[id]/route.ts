import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES, CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { CustomerNotFoundError, getAdminCustomerById, updateAdminCustomer } from "@/lib/customers/admin";
import { adminCustomerPatchSchema } from "@/lib/customers/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildValidationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

function buildNotFoundResponse(customerId: string) {
  return NextResponse.json({ error: "CUSTOMER_NOT_FOUND", customerId }, { status: 404 });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    await requireRole(ADMIN_ROLES);

    const detail = await getAdminCustomerById(context.params.id);

    if (!detail) {
      return buildNotFoundResponse(context.params.id);
    }

    return NextResponse.json(detail);
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(CUSTOMER_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = adminCustomerPatchSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationError(parsedInput.error);
    }

    const result = await updateAdminCustomer(context.params.id, parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json({
      customer: result.customer,
      changedFields: result.changedFields,
    });
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return buildNotFoundResponse(context.params.id);
    }

    return toAdminErrorResponse(error);
  }
}
