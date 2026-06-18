import type { BookingStatus } from "@prisma/client";

export type BookingAction = "issue" | "cancel" | "expire" | "refund";

export type BookingTransitionResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
    };

export function canTransition(from: BookingStatus, action: BookingAction): BookingTransitionResult {
  if (action === "issue") {
    return from === "HELD"
      ? { ok: true }
      : { ok: false, reason: `Chỉ booking HELD mới được xuất vé, trạng thái hiện tại là ${from}.` };
  }

  if (action === "cancel") {
    return from === "HELD" || from === "TICKETED"
      ? { ok: true }
      : { ok: false, reason: `Chỉ booking HELD hoặc TICKETED mới được hủy, trạng thái hiện tại là ${from}.` };
  }

  if (action === "expire") {
    return from === "HELD" || from === "PENDING_PAYMENT"
      ? { ok: true }
      : { ok: false, reason: `Chỉ booking HELD hoặc PENDING_PAYMENT mới được đánh dấu hết hạn, trạng thái hiện tại là ${from}.` };
  }

  return from === "TICKETED" || from === "CANCELLED"
    ? { ok: true }
    : { ok: false, reason: `Chỉ booking TICKETED hoặc CANCELLED mới được hoàn tiền, trạng thái hiện tại là ${from}.` };
}
