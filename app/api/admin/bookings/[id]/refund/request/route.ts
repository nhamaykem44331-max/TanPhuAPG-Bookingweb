import { BookingStatus, Prisma, RefundStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { TICKETING_QUEUE_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { assertTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { refundRequestInputSchema } from "@/lib/bookings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildValidationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: "VALIDATION_ERROR", fieldErrors: error.flatten().fieldErrors },
    { status: 422 },
  );
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(TICKETING_QUEUE_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "refundRequest");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = refundRequestInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();
    const actorId = session.user.id;
    const now = new Date();
    const { amount, reason } = parsedInput.data;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${context.params.id} FOR UPDATE`;

      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        select: { id: true, status: true, pnr: true, orderCode: true, saleAmount: true, currency: true },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      const transition = assertTransition(booking.status, BookingStatus.REFUND_REQUIRED);

      if (!transition.ok) {
        return { kind: "invalid_status" as const, currentStatus: booking.status, reason: transition.reason };
      }

      const payments = await tx.payment.findMany({
        where: { bookingId: booking.id },
        select: { amount: true, status: true },
      });
      const summary = calculatePaymentSummary(payments, booking.saleAmount);

      if (amount > summary.totalPaid) {
        return { kind: "amount_exceeds_paid" as const, totalPaid: summary.totalPaid };
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.REFUND_REQUIRED },
      });

      const refund = await tx.refund.create({
        data: {
          bookingId: booking.id,
          amount,
          reason,
          status: RefundStatus.REQUIRED,
        },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "REFUND_REQUESTED",
          title: "Yêu cầu hoàn tiền",
          payload: toJsonValue({ refundId: refund.id, amount, reason, actorId }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.refund_request",
          before: toJsonValue({ status: booking.status }),
          after: toJsonValue({ status: updated.status, refundId: refund.id, amount }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return { kind: "requested" as const, booking: updated, refund };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "BOOKING_NOT_FOUND", bookingId: context.params.id }, { status: 404 });
    }

    if (result.kind === "invalid_status") {
      return NextResponse.json(
        { error: "INVALID_STATUS", currentStatus: result.currentStatus, message: result.reason },
        { status: 409 },
      );
    }

    if (result.kind === "amount_exceeds_paid") {
      return NextResponse.json(
        {
          error: "REFUND_EXCEEDS_PAID",
          message: `Số tiền hoàn vượt quá tổng đã thu ${new Intl.NumberFormat("vi-VN").format(result.totalPaid)} VND.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ booking: result.booking, refund: result.refund }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
