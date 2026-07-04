import { NextResponse } from "next/server";

import { PAYMENT_CAPTURE_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { cancelSepayIntent, SepayError } from "@/lib/payments/sepayService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_: Request, context: { params: { id: string; intentId: string } }) {
  try {
    const session = await requireRole(PAYMENT_CAPTURE_ROLES);
    await assertCanMutateBooking(
      { userId: session.user.id, role: session.user.role },
      context.params.id,
      "addPayment",
    );
    const result = await cancelSepayIntent(context.params.id, context.params.intentId, session.user.id);

    return NextResponse.json({
      intent: result.intent,
      outcome: result.outcome,
    });
  } catch (error) {
    if (error instanceof SepayError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return toAdminErrorResponse(error);
  }
}
