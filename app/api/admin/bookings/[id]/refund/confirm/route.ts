import {
  BookingStatus,
  NotificationAudience,
  NotificationJobChannel,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { REFUND_MANAGER_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { assertTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { refundConfirmInputSchema } from "@/lib/bookings/schemas";
import { enqueueNotification } from "@/lib/notifications/jobs";

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
    const session = await requireRole(REFUND_MANAGER_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "refundConfirm");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = refundConfirmInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();
    const actorId = session.user.id;
    const refundedAt = parsedInput.data.refundedAt ? new Date(parsedInput.data.refundedAt) : new Date();
    const { refundId, method, transactionRef, notes } = parsedInput.data;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${context.params.id} FOR UPDATE`;

      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        select: { id: true, status: true, pnr: true, orderCode: true, currency: true },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      const transition = assertTransition(booking.status, BookingStatus.REFUNDED);

      if (!transition.ok) {
        return { kind: "invalid_status" as const, currentStatus: booking.status, reason: transition.reason };
      }

      const refund = refundId
        ? await tx.refund.findFirst({ where: { id: refundId, bookingId: booking.id } })
        : await tx.refund.findFirst({
            where: { bookingId: booking.id, status: { in: [RefundStatus.REQUIRED, RefundStatus.PROCESSING] } },
            orderBy: { createdAt: "desc" },
          });

      if (!refund) {
        return { kind: "refund_not_found" as const };
      }

      if (refund.status === RefundStatus.REFUNDED) {
        return { kind: "already_refunded" as const };
      }

      const updatedRefund = await tx.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.REFUNDED, processedById: actorId, refundedAt },
      });

      // Ghi nhận dòng tiền ra (âm) để công nợ/đối soát phản ánh đúng số đã hoàn.
      const refundPayment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: method as PaymentMethod,
          amount: -refund.amount,
          currency: booking.currency,
          status: PaymentStatus.REFUNDED,
          paidAt: refundedAt,
          transactionRef,
          notes: notes ?? `Hoàn tiền: ${refund.reason}`,
          receivedById: actorId,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.REFUNDED },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "REFUND_DONE",
          title: "Đã hoàn tiền cho khách",
          payload: toJsonValue({
            refundId: refund.id,
            amount: refund.amount,
            paymentId: refundPayment.id,
            actorId,
          }),
          occurredAt: refundedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.refund_confirm",
          before: toJsonValue({ status: booking.status, refundStatus: refund.status }),
          after: toJsonValue({
            status: updatedBooking.status,
            refundStatus: updatedRefund.status,
            paymentId: refundPayment.id,
            amount: refund.amount,
          }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      await enqueueNotification(tx, {
        type: "REFUND_DONE",
        channel: NotificationJobChannel.ZNS,
        audience: NotificationAudience.CUSTOMER,
        bookingId: booking.id,
        idempotencyKey: `refund-done:${refund.id}`,
        payload: { orderCode: booking.orderCode, amount: refund.amount },
      });

      return { kind: "refunded" as const, booking: updatedBooking, refund: updatedRefund, payment: refundPayment };
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

    if (result.kind === "refund_not_found") {
      return NextResponse.json({ error: "REFUND_NOT_FOUND" }, { status: 404 });
    }

    if (result.kind === "already_refunded") {
      return NextResponse.json({ error: "ALREADY_REFUNDED" }, { status: 409 });
    }

    return NextResponse.json({ booking: result.booking, refund: result.refund, payment: result.payment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
