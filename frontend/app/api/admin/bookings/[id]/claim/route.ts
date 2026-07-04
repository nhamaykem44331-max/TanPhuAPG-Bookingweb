import { BookingStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { TICKETING_QUEUE_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { assertTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { claimBookingInputSchema } from "@/lib/bookings/schemas";

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
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "claim");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = claimBookingInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();
    const actorId = session.user.id;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${context.params.id} FOR UPDATE`;

      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        select: { id: true, status: true, pnr: true, assignedToId: true },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      // Đã có người khác nhận → báo xung đột; nhận lại bởi chính mình → idempotent.
      if (booking.status === BookingStatus.TICKETING) {
        if (booking.assignedToId && booking.assignedToId !== actorId) {
          return { kind: "already_claimed" as const, assignedToId: booking.assignedToId };
        }

        if (booking.assignedToId === actorId) {
          return { kind: "claimed" as const, booking, idempotent: true };
        }
      }

      if (booking.status !== BookingStatus.TICKETING) {
        const transition = assertTransition(booking.status, BookingStatus.TICKETING);

        if (!transition.ok) {
          return { kind: "invalid_status" as const, currentStatus: booking.status, reason: transition.reason };
        }
      }

      const claimed = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.TICKETING, assignedToId: actorId },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "TICKETING_CLAIMED",
          title: "Nhận xử lý xuất vé",
          payload: toJsonValue({ actorId, notes: parsedInput.data.notes }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.claim",
          before: toJsonValue({ status: booking.status, assignedToId: booking.assignedToId }),
          after: toJsonValue({ status: claimed.status, assignedToId: claimed.assignedToId }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return { kind: "claimed" as const, booking: claimed, idempotent: false };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "BOOKING_NOT_FOUND", bookingId: context.params.id }, { status: 404 });
    }

    if (result.kind === "already_claimed") {
      return NextResponse.json(
        { error: "ALREADY_CLAIMED", assignedToId: result.assignedToId },
        { status: 409 },
      );
    }

    if (result.kind === "invalid_status") {
      return NextResponse.json(
        { error: "INVALID_STATUS", currentStatus: result.currentStatus, message: result.reason },
        { status: 409 },
      );
    }

    return NextResponse.json({ booking: result.booking, idempotent: result.idempotent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
