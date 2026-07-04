import type { BookingStatus } from "@prisma/client";

import type { Tone } from "@/lib/admin/ui/tones";

// HANDOFF I.2 — bản đồ trạng thái đơn → nhãn tiếng Việt + tone màu (parity với `meta()`
// trong file thiết kế). Dùng `Record<BookingStatus, …>` để tsc bắt lỗi nếu enum đổi.
export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  QUOTED: { label: "Đã báo giá", tone: "muted" },
  HELD: { label: "Đang giữ chỗ", tone: "warn" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "teal" },
  PAID: { label: "Đã trả · chờ xuất", tone: "rust" },
  TICKETING: { label: "Đang xuất vé", tone: "info" },
  TICKETED: { label: "Đã xuất vé", tone: "ok" },
  CANNOT_ISSUE: { label: "Không xuất được", tone: "red" },
  REFUND_REQUIRED: { label: "Cần hoàn tiền", tone: "plum" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "ok" },
  PAYMENT_FAILED: { label: "Thanh toán lỗi", tone: "red" },
  EXPIRED: { label: "Hết hạn giữ", tone: "muted" },
  CANCELLED: { label: "Đã huỷ", tone: "muted" },
};

export function statusMeta(status: BookingStatus): StatusMeta {
  return STATUS_META[status] ?? { label: status, tone: "muted" };
}
