import type { Booking } from "@prisma/client";

/**
 * Kiểm tra snapshot giá bán còn đủ mới để tiếp tục dùng cho bước nghiệp vụ tiếp theo.
 * Sprint D chỉ định nghĩa helper; Sprint E re-issue/re-price sẽ quyết định cách enforce.
 */
export function isPriceLockFresh(lockedAt: Date | null, maxAgeMinutes = 60): boolean {
  if (!lockedAt) {
    return false;
  }

  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  return Date.now() - lockedAt.getTime() <= maxAgeMs;
}

/**
 * priceLockedAt là thời điểm lần cuối giá sale được khóa cho khách.
 * Tạm thời issue flow chưa đổi logic; helper này là điểm nối cho Sprint E.
 */
export function shouldRequoteBeforeIssue(booking: Booking): boolean {
  return !isPriceLockFresh(booking.priceLockedAt);
}
