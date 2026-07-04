import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import {
  getMarkupRuleById,
  MarkupRuleNotFoundError,
  softDeleteMarkupRule,
  updateMarkupRule,
} from "@/lib/pricing/markupRules";
import { markupRulePatchSchema } from "@/lib/pricing/schemas";

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

function buildNotFoundResponse(ruleId: string) {
  return NextResponse.json({ error: `Không tìm thấy rule ${ruleId}.` }, { status: 404 });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    await requireRole(MARKUP_RULE_MANAGER_ROLES);
    const rule = await getMarkupRuleById(context.params.id);

    if (!rule) {
      return buildNotFoundResponse(context.params.id);
    }

    return NextResponse.json({ rule });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(MARKUP_RULE_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = markupRulePatchSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationError(parsedInput.error);
    }

    const result = await updateMarkupRule(context.params.id, parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json({ rule: result.rule });
  } catch (error) {
    if (error instanceof MarkupRuleNotFoundError) {
      return buildNotFoundResponse(context.params.id);
    }

    return toAdminErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(MARKUP_RULE_MANAGER_ROLES);
    await softDeleteMarkupRule(context.params.id, session.user.id, getAuditRequestMeta());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof MarkupRuleNotFoundError) {
      return buildNotFoundResponse(context.params.id);
    }

    return toAdminErrorResponse(error);
  }
}
