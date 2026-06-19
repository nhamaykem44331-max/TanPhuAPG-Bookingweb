import { PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { PAYMENT_CAPTURE_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { settleBookingIfFullyPaid } from "@/lib/booking/paidTransition";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { adminBookingPaymentInputSchema } from "@/lib/bookings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYABLE_BOOKING_STATUSES = new Set(["HELD", "TICKETED"]);

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

function buildFieldErrorResponse(field: string, message: string) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      message,
      fieldErrors: {
        [field]: [message],
      },
    },
    { status: 422 },
  );
}

function buildNotFoundResponse(entity: string, entityId: string) {
  return NextResponse.json({ error: `${entity.toUpperCase()}_NOT_FOUND`, entityId }, { status: 404 });
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(PAYMENT_CAPTURE_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "addPayment");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => null);
    const parsedInput = adminBookingPaymentInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        include: {
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              amount: true,
              status: true,
            },
          },
        },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      if (!PAYABLE_BOOKING_STATUSES.has(booking.status)) {
        return {
          kind: "invalid_status" as const,
          status: booking.status,
        };
      }

      const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);

      if (paymentSummary.balance <= 0) {
        return {
          kind: "amount_error" as const,
          message: "Booking này đã được thanh toán đủ, không thể ghi thêm payment.",
        };
      }

      if (parsedInput.data.amount > paymentSummary.balance) {
        return {
          kind: "amount_error" as const,
          message: `Số tiền vượt quá công nợ hiện tại ${new Intl.NumberFormat("vi-VN").format(paymentSummary.balance)} VND.`,
        };
      }

      const paymentStatus =
        parsedInput.data.amount === paymentSummary.balance ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      const paidAt = parsedInput.data.paidAt ? new Date(parsedInput.data.paidAt) : new Date();

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: parsedInput.data.method,
          amount: parsedInput.data.amount,
          currency: booking.currency,
          status: paymentStatus,
          paidAt,
          proofUrl: parsedInput.data.proofUrl,
          transactionRef: parsedInput.data.transactionRef,
          notes: parsedInput.data.notes,
          receivedById: session.user.id,
        },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "PAYMENT_RECORDED",
          title: "Ghi nhận thanh toán thủ công",
          payload: toJsonValue({
            paymentId: payment.id,
            method: payment.method,
            amount: payment.amount,
            status: payment.status,
          }),
          occurredAt: paidAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          entity: "Payment",
          entityId: payment.id,
          action: "payment.create",
          before: Prisma.JsonNull,
          after: toJsonValue(payment),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      // Phần D — thu tay đủ tiền cũng đẩy booking vào hàng đợi xuất vé như SePay.
      const settled =
        paymentStatus === PaymentStatus.PAID
          ? await settleBookingIfFullyPaid(tx, {
              bookingId: booking.id,
              paidAt,
              actorId: session.user.id,
              source: "admin",
            })
          : false;

      return {
        kind: "created" as const,
        payment,
        settled,
      };
    });

    if (result.kind === "not_found") {
      return buildNotFoundResponse("booking", context.params.id);
    }

    if (result.kind === "invalid_status") {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: `Booking đang ở trạng thái ${result.status}, không thể ghi nhận thanh toán.`,
        },
        { status: 409 },
      );
    }

    if (result.kind === "amount_error") {
      return buildFieldErrorResponse("amount", result.message);
    }

    return NextResponse.json({ payment: result.payment, settled: result.settled }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
