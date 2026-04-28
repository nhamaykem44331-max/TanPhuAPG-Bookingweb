import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAuditRequestMeta } from "@/lib/audit";
import { PAYMENT_REJECT_ROLES } from "@/lib/auth/constants";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildNotFoundResponse(entity: string, entityId: string) {
  return NextResponse.json({ error: `${entity.toUpperCase()}_NOT_FOUND`, entityId }, { status: 404 });
}

export async function DELETE(_: Request, context: { params: { id: string; paymentId: string } }) {
  try {
    const session = await requireRole(PAYMENT_REJECT_ROLES);
    await syncBookingOrderById(context.params.id);
    const auditMeta = getAuditRequestMeta();

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          id: context.params.paymentId,
          bookingId: context.params.id,
        },
      });

      if (!payment) {
        return { kind: "not_found" as const };
      }

      if (payment.status === "REJECTED") {
        return { kind: "already_rejected" as const };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          entity: "Payment",
          entityId: payment.id,
          action: "payment.reject",
          before: toJsonValue(payment),
          after: toJsonValue(updatedPayment),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return {
        kind: "updated" as const,
      };
    });

    if (result.kind === "not_found") {
      return buildNotFoundResponse("payment", context.params.paymentId);
    }

    if (result.kind === "already_rejected") {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: "Payment này đã ở trạng thái REJECTED.",
        },
        { status: 409 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
