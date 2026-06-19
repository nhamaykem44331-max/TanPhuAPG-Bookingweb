import type { BookingStatus } from "@prisma/client";

export type BookingTransitionResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
    };

// Phần C.2 — máy trạng thái booking theo luồng OpenFly: báo giá → giữ chỗ →
// thanh toán → hàng đợi xuất vé → xuất vé / không xuất được → hoàn tiền.
// Mỗi key liệt kê các trạng thái đích hợp lệ; mảng rỗng = trạng thái kết thúc.
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  QUOTED: ["HELD", "CANCELLED", "EXPIRED"],
  HELD: ["PENDING_PAYMENT", "PAID", "EXPIRED", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["TICKETING", "TICKETED", "CANNOT_ISSUE"],
  TICKETING: ["TICKETED", "CANNOT_ISSUE"],
  TICKETED: [],
  CANNOT_ISSUE: ["REFUND_REQUIRED", "TICKETING"],
  REFUND_REQUIRED: ["REFUNDED"],
  REFUNDED: [],
  PAYMENT_FAILED: ["HELD", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  QUOTED: "Đã báo giá",
  HELD: "Đang giữ chỗ",
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã trả · chờ xuất",
  TICKETING: "Đang xuất vé",
  TICKETED: "Đã xuất vé",
  CANNOT_ISSUE: "Không xuất được",
  REFUND_REQUIRED: "Cần hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
  PAYMENT_FAILED: "Thanh toán lỗi",
  EXPIRED: "Hết hạn giữ",
  CANCELLED: "Đã huỷ",
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

// Bản có lý do để API trả về thông báo tiếng Việt cho người dùng cuối.
export function assertTransition(from: BookingStatus, to: BookingStatus): BookingTransitionResult {
  if (canTransition(from, to)) {
    return { ok: true };
  }

  const allowed = BOOKING_TRANSITIONS[from] ?? [];
  const allowedLabel = allowed.length
    ? allowed.map((status) => STATUS_LABEL[status]).join(", ")
    : "không còn bước tiếp theo (trạng thái kết thúc)";

  return {
    ok: false,
    reason: `Không thể chuyển từ "${STATUS_LABEL[from]}" sang "${STATUS_LABEL[to]}". Bước hợp lệ: ${allowedLabel}.`,
  };
}
