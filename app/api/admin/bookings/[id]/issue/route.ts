import { BookingStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { ADMIN_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { assertTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { issueTicketInputSchema } from "@/lib/bookings/schemas";
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

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireRole(ADMIN_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "issue");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = issueTicketInputSchema.safeParse(body);

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
            select: {
              amount: true,
              status: true,
            },
          },
          pnrs: {
            select: {
              pnr: true,
              status: true,
            },
          },
        },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      const transition = assertTransition(booking.status, BookingStatus.TICKETED);

      if (!transition.ok) {
        return {
          kind: "invalid_status" as const,
          currentStatus: booking.status,
          reason: transition.reason,
        };
      }

      const paymentSummary = calculatePaymentSummary(booking.payments, booking.saleAmount);

      if (paymentSummary.balance > 0) {
        return {
          kind: "insufficient_payment" as const,
          balance: paymentSummary.balance,
        };
      }

      if (booking.ttlExpiresAt && booking.ttlExpiresAt.getTime() < now.getTime()) {
        const expiredBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.EXPIRED,
          },
        });

        await tx.bookingTimelineEvent.create({
          data: {
            bookingId: booking.id,
            pnr: booking.pnr,
            source: "admin",
            eventType: "BOOKING_EXPIRED",
            title: "Booking hết hạn giữ chỗ",
            payload: toJsonValue({
              actorId: session.user.id,
              ttlExpiresAt: booking.ttlExpiresAt.toISOString(),
              attemptedAction: "issue",
            }),
            occurredAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            entity: "Booking",
            entityId: booking.id,
            action: "booking.expire",
            before: toJsonValue({
              status: booking.status,
              ttlExpiresAt: booking.ttlExpiresAt.toISOString(),
            }),
            after: toJsonValue({
              status: expiredBooking.status,
              ttlExpiresAt: expiredBooking.ttlExpiresAt?.toISOString() ?? null,
            }),
            ip: auditMeta.ip,
            userAgent: auditMeta.userAgent,
          },
        });

        return {
          kind: "expired" as const,
          booking: expiredBooking,
        };
      }

      const hasValidPnr = booking.pnrs.some((pnr) => pnr.status === "SUCCESS");

      if (!hasValidPnr) {
        return {
          kind: "no_valid_pnr" as const,
        };
      }

      const issuedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.TICKETED,
          priceLockedAt: now,
        },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "TICKET_ISSUED",
          title: "Xác nhận xuất vé",
          payload: toJsonValue({
            ticketNumbers: parsedInput.data.ticketNumbers ?? [],
            actorId: session.user.id,
            notes: parsedInput.data.notes,
          }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.issue",
          before: toJsonValue({
            status: booking.status,
            priceLockedAt: booking.priceLockedAt?.toISOString() ?? null,
          }),
          after: toJsonValue({
            status: issuedBooking.status,
            priceLockedAt: issuedBooking.priceLockedAt?.toISOString() ?? null,
          }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return {
        kind: "issued" as const,
        booking: issuedBooking,
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

    if (result.kind === "insufficient_payment") {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_PAYMENT",
          balance: result.balance,
        },
        { status: 409 },
      );
    }

    if (result.kind === "expired") {
      return NextResponse.json(
        {
          error: "EXPIRED",
          booking: result.booking,
        },
        { status: 409 },
      );
    }

    if (result.kind === "no_valid_pnr") {
      return NextResponse.json({ error: "NO_VALID_PNR" }, { status: 409 });
    }

    void notify({ type: "BOOKING_ISSUED", bookingId: result.booking.id, ticketNumbers: parsedInput.data.ticketNumbers });

    return NextResponse.json({ booking: result.booking });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
