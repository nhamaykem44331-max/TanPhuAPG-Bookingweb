import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { createMarkupRule, listMarkupRules } from "@/lib/pricing/markupRules";
import { markupRuleInputSchema, markupRuleListFilterSchema } from "@/lib/pricing/schemas";

export const dynamic = "force-dynamic";

function buildValidationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

export async function GET(request: Request) {
  try {
    await requireRole(MARKUP_RULE_MANAGER_ROLES);

    const url = new URL(request.url);
    const filters = markupRuleListFilterSchema.safeParse({
      active: url.searchParams.get("active"),
      airline: url.searchParams.get("airline"),
    });

    if (!filters.success) {
      return buildValidationError(filters.error);
    }

    const rules = await listMarkupRules(filters.data);
    return NextResponse.json({ rules });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(MARKUP_RULE_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = markupRuleInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationError(parsedInput.error);
    }

    const rule = await createMarkupRule(parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
