import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { CustomerMergeError, mergeCustomers } from "@/lib/customer/mergeService";
import { customerMergeInputSchema } from "@/lib/customers/schemas";

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

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json().catch(() => null);
    const parsedInput = customerMergeInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationError(parsedInput.error);
    }

    const result = await mergeCustomers(
      context.params.id,
      parsedInput.data.mergedCustomerIds,
      session.user.id,
      getAuditRequestMeta(),
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerMergeError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }

    return toAdminErrorResponse(error);
  }
}
