import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES, PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { createPriceAlert, listPriceAlerts, PriceAlertError } from "@/lib/price-alerts/admin";
import { priceAlertInputSchema, priceAlertListQuerySchema } from "@/lib/price-alerts/schemas";

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

function priceAlertError(error: PriceAlertError) {
  return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(ADMIN_ROLES);

    const parsedQuery = priceAlertListQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      airline: request.nextUrl.searchParams.get("airline") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsedQuery.success) {
      return validationError(parsedQuery.error);
    }

    return NextResponse.json(await listPriceAlerts(parsedQuery.data));
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);
    const body = await request.json().catch(() => null);
    const parsedInput = priceAlertInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return validationError(parsedInput.error);
    }

    const alert = await createPriceAlert(parsedInput.data, session.user.id, getAuditRequestMeta());
    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    if (error instanceof PriceAlertError) {
      return priceAlertError(error);
    }

    return toAdminErrorResponse(error);
  }
}
