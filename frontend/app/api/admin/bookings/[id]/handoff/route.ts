import { BookingStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuditRequestMeta } from "@/lib/audit";
import { RMS_HANDOFF_ROLES } from "@/lib/auth/constants";
import { assertCanMutateBooking } from "@/lib/auth/ownership";
import { requireRole, toAdminErrorResponse } from "@/lib/auth/requireRole";
import { syncBookingOrderById } from "@/lib/bookings/orderManagement";
import { prisma } from "@/lib/db";
import { handoffInputSchema } from "@/lib/bookings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Chỉ bàn giao sang RMS khi đơn đã chốt: xuất vé xong, đã hoàn tiền, hoặc đã hủy.
const HANDOFF_ALLOWED_STATUSES: BookingStatus[] = [
  BookingStatus.TICKETED,
  BookingStatus.REFUNDED,
  BookingStatus.CANCELLED,
];

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
    const session = await requireRole(RMS_HANDOFF_ROLES);
    await assertCanMutateBooking({ userId: session.user.id, role: session.user.role }, context.params.id, "handoff");
    await syncBookingOrderById(context.params.id);
    const body = await request.json().catch(() => ({}));
    const parsedInput = handoffInputSchema.safeParse(body);

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
        select: { id: true, status: true, pnr: true, orderCode: true, rmsSyncedAt: true },
      });

      if (!booking) {
        return { kind: "not_found" as const };
      }

      if (booking.rmsSyncedAt) {
        return { kind: "handoff" as const, booking, idempotent: true };
      }

      if (!HANDOFF_ALLOWED_STATUSES.includes(booking.status)) {
        return { kind: "invalid_status" as const, currentStatus: booking.status };
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { rmsSyncedAt: now },
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: booking.id,
          pnr: booking.pnr,
          source: "admin",
          eventType: "RMS_HANDOFF",
          title: "Bàn giao sang RMS để hạch toán",
          payload: toJsonValue({ actorId, notes: parsedInput.data.notes, status: booking.status }),
          occurredAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: booking.id,
          action: "booking.rms_handoff",
          before: toJsonValue({ rmsSyncedAt: null }),
          after: toJsonValue({ rmsSyncedAt: updated.rmsSyncedAt?.toISOString() ?? null }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return { kind: "handoff" as const, booking: updated, idempotent: false };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "BOOKING_NOT_FOUND", bookingId: context.params.id }, { status: 404 });
    }

    if (result.kind === "invalid_status") {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          currentStatus: result.currentStatus,
          message: `Chỉ bàn giao RMS khi đơn đã TICKETED, REFUNDED hoặc CANCELLED (hiện ${result.currentStatus}).`,
        },
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
