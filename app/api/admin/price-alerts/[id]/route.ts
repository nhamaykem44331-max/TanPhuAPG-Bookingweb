import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES, PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { getPriceAlertById, PriceAlertError, softDeletePriceAlert, updatePriceAlertStatus } from "@/lib/price-alerts/admin";
import { priceAlertPatchSchema } from "@/lib/price-alerts/schemas";

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

function notFound(alertId: string) {
  return NextResponse.json({ error: "PRICE_ALERT_NOT_FOUND", alertId }, { status: 404 });
}

function priceAlertError(error: PriceAlertError) {
  return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    await requireRole(ADMIN_ROLES);

    const alert = await getPriceAlertById(context.params.id);

    if (!alert) {
      return notFound(context.params.id);
    }

    return NextResponse.json({ alert });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = priceAlertPatchSchema.safeParse(body);

    if (!parsedInput.success) {
      return validationError(parsedInput.error);
    }

    const result = await updatePriceAlertStatus(context.params.id, parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PriceAlertError) {
      return priceAlertError(error);
    }

    return toAdminErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);

    await softDeletePriceAlert(context.params.id, session.user.id, getAuditRequestMeta());
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof PriceAlertError) {
      return priceAlertError(error);
    }

    return toAdminErrorResponse(error);
  }
}
