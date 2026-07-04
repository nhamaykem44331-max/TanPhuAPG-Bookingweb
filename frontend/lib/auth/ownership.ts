import type { BookingStatus, Prisma, Role } from "@prisma/client";

import { AdminRouteError } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/db";

export interface OwnershipContext {
  userId: string;
  role: Role;
}

export type BookingMutationAction =
  | "issue"
  | "cancel"
  | "addPayment"
  | "claim"
  | "cannotIssue"
  | "refundRequest"
  | "refundConfirm"
  | "handoff";

export function bookingListWhereForRole(
  ctx: OwnershipContext,
  baseWhere: Prisma.BookingWhereInput,
): Prisma.BookingWhereInput {
  if (ctx.role !== "NHAN_VIEN_BAN") {
    return baseWhere;
  }

  return {
    AND: [baseWhere, { createdById: ctx.userId }],
  };
}

export function canRoleMutateBookingAction(role: Role, action: BookingMutationAction): boolean {
  if (role === "SUPER_ADMIN" || role === "QUAN_LY_DAI_LY") {
    return true;
  }

  if (role === "NHAN_VIEN_BAN") {
    // NV bán làm toàn bộ luồng bán → xuất vé, trừ xác nhận hoàn tiền và bàn giao RMS.
    return action !== "refundConfirm" && action !== "handoff";
  }

  return action === "addPayment";
}

export function bookingAccessBadge(ctx: OwnershipContext, booking: { createdById: string | null; status: BookingStatus }): string {
  if (ctx.role === "KE_TOAN") {
    return "Read-only (Kế toán)";
  }

  if (ctx.role === "NHAN_VIEN_BAN") {
    return booking.createdById === ctx.userId ? "Bạn là chủ booking" : "Không thuộc phạm vi của bạn";
  }

  return "Xem dưới quyền quản lý";
}

async function getBookingOwner(bookingId: string): Promise<{ createdById: string | null } | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: { createdById: true },
  });
}

export async function assertCanViewBooking(ctx: OwnershipContext, bookingId: string): Promise<void> {
  const booking = await getBookingOwner(bookingId);

  if (!booking) {
    throw new AdminRouteError(404, "BOOKING_NOT_FOUND");
  }

  if (ctx.role === "NHAN_VIEN_BAN" && booking.createdById !== ctx.userId) {
    throw new AdminRouteError(404, "BOOKING_NOT_FOUND");
  }
}

export async function assertCanMutateBooking(
  ctx: OwnershipContext,
  bookingId: string,
  action: BookingMutationAction,
): Promise<void> {
  if (!canRoleMutateBookingAction(ctx.role, action)) {
    throw new AdminRouteError(403, "READ_ONLY_ROLE");
  }

  const booking = await getBookingOwner(bookingId);

  if (!booking) {
    throw new AdminRouteError(404, "BOOKING_NOT_FOUND");
  }

  if (ctx.role === "NHAN_VIEN_BAN" && booking.createdById !== ctx.userId) {
    throw new AdminRouteError(403, "BOOKING_NOT_OWNED");
  }
}
