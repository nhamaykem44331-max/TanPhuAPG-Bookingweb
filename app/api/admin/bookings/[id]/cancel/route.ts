import { BookingStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { canTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { cancelBookingInputSchema } from "@/lib/bookings/schemas";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildValidationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      fieldErrors: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}

function buildNotFoundResponse(bookingId: string) {
  return NextResponse.json({ error: "BOOKING_NOT_FOUND", bookingId }, { status: 404 });
}

function buildUnprocessableResponse(error: string, message?: string) {
  return NextResponse.json(
    {
      error,
      ...(message ? { message } : {}),
    },
    { status: 422 },
  );
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(ADMIN_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "cancel");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = cancelBookingInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${context.params.id} FOR UPDATE`;

      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        include: {
          payments: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      const transition = canTransition(booking.status, "cancel");

      if (!transition.ok) {
        return {
          kind: "invalid_status" as const,
          currentStatus: booking.status,
          reason: transition.reason,
        };
      }

      const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);
      const paidPayments = booking.payments.filter((payment) => payment.status === PaymentStatus.PAID);
      const { reason, detail, markRefund, refundAmount } = parsedInput.data;

      if (markRefund && booking.status !== BookingStatus.TICKETED) {
        return { kind: "refund_requires_ticketed" as const };
      }

      if (markRefund && paidPayments.length === 0) {
        return { kind: "no_paid_payment_to_refund" as const };
      }

      if (markRefund && refundAmount && refundAmount > paymentSummary.totalPaid) {
        return {
          kind: "refund_exceeds_paid" as const,
          totalPaid: paymentSummary.totalPaid,
        };
      }

      const cancelledBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      const refundPayment = markRefund && refundAmount
        ? await tx.payment.create({
            data: {
              bookingId: booking.id,
              method: PaymentMethod.BANK,
              amount: -refundAmount,
              currency: booking.currency,
              status: PaymentStatus.REFUNDED,
              paidAt: now,
              notes: `Refund: ${reason}${detail ? ` - ${detail}` : ""}`,
              receivedById: session.user.id,
            },
          })
        : null;

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "BOOKING_CANCELLED",
          title: "Hủy booking",
          payload: toJsonValue({
            reason,
            detail,
            ...(refundAmount ? { refundAmount } : {}),
            ...(refundPayment ? { refundPaymentId: refundPayment.id } : {}),
          }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.cancel",
          before: toJsonValue({
            status: booking.status,
            paymentCount: booking.payments.length,
          }),
          after: toJsonValue({
            status: cancelledBooking.status,
            ...(refundPayment ? { refundPaymentId: refundPayment.id } : {}),
          }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      if (refundPayment) {
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            entity: "Payment",
            entityId: refundPayment.id,
            action: "payment.create",
            before: Prisma.JsonNull,
            after: toJsonValue(refundPayment),
            ip: auditMeta.ip,
            userAgent: auditMeta.userAgent,
          },
        });
      }

      return {
        kind: "cancelled" as const,
        booking: cancelledBooking,
        refund: refundPayment,
      };
    });

    if (result.kind === "not_found") {
      return buildNotFoundResponse(context.params.id);
    }

    if (result.kind === "invalid_status") {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          currentStatus: result.currentStatus,
          message: result.reason,
        },
        { status: 409 },
      );
    }

    if (result.kind === "refund_requires_ticketed") {
      return buildUnprocessableResponse("REFUND_REQUIRES_TICKETED");
    }

    if (result.kind === "no_paid_payment_to_refund") {
      return buildUnprocessableResponse("NO_PAID_PAYMENT_TO_REFUND");
    }

    if (result.kind === "refund_exceeds_paid") {
      return buildUnprocessableResponse("REFUND_EXCEEDS_PAID", `Số tiền hoàn vượt quá tổng đã thu ${result.totalPaid} VND.`);
    }

    void notify({
      type: "BOOKING_CANCELLED",
      bookingId: result.booking.id,
      reason: parsedInput.data.reason,
      refundAmount: parsedInput.data.refundAmount,
    });

    return NextResponse.json({
      booking: result.booking,
      ...(result.refund ? { refund: result.refund } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
