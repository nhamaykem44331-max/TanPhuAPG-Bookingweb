import { BookingStatus, NotificationAudience, NotificationJobChannel, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { TICKETING_QUEUE_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { assertTransition } from "@/lib/booking/stateMachine";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { cannotIssueInputSchema } from "@/lib/bookings/schemas";
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
    const session = await requireRole(TICKETING_QUEUE_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "cannotIssue");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = cannotIssueInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return buildValidationErrorResponse(parsedInput.error);
    }

    const auditMeta = getAuditRequestMeta();
    const actorId = session.user.id;
    const now = new Date();
    const { reason, detail } = parsedInput.data;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${context.params.id} FOR UPDATE`;

      const booking = await tx.booking.findUnique({
        where: { id: context.params.id },
        select: { id: true, status: true, pnr: true, orderCode: true, slaDueAt: true },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      const transition = assertTransition(booking.status, BookingStatus.CANNOT_ISSUE);

      if (!transition.ok) {
        return { kind: "invalid_status" as const, currentStatus: booking.status, reason: transition.reason };
      }

      // Hết SLA xuất vé — gỡ slaDueAt để đơn không còn nằm trong cảnh báo quá hạn.
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANNOT_ISSUE, slaDueAt: null },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "CANNOT_ISSUE",
          title: "Không xuất được vé",
          payload: toJsonValue({ reason, detail, actorId }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.cannot_issue",
          before: toJsonValue({ status: booking.status, slaDueAt: booking.slaDueAt?.toISOString() ?? null }),
          after: toJsonValue({ status: updated.status, slaDueAt: null, reason }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      await enqueueNotification(tx, {
        type: "CANNOT_ISSUE",
        channel: NotificationJobChannel.ZALO_OA,
        audience: NotificationAudience.INTERNAL,
        bookingId: booking.id,
        payload: { orderCode: booking.orderCode, reason, detail },
      });

      return { kind: "done" as const, booking: updated };
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

    return NextResponse.json({ booking: result.booking });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    return toAdminErrorResponse(error);
  }
}
