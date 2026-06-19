// HANDOFF Phần J — định dạng tiền/ngày/giờ dùng chung cho admin OpenFly. `money()` trong
// file thiết kế là `(n||0).toLocaleString('vi-VN') + '₫'` (không có dấu cách trước ₫).
// Mọi formatter cố định timezone Asia/Ho_Chi_Minh để khớp nghiệp vụ trong nước.

const VND = new Intl.NumberFormat("vi-VN");

const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const DATETIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12.345.678₫" — khớp money() của file thiết kế. */
export function formatVnd(value: number | null | undefined): string {
  return `${VND.format(value ?? 0)}₫`;
}

/** Số thuần theo locale vi-VN (không hậu tố tiền tệ). */
export function formatNumber(value: number | null | undefined): string {
  return VND.format(value ?? 0);
}

export function formatDate(value: Date | string | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  return date ? DATE_FMT.format(date) : fallback;
}

export function formatDateTime(value: Date | string | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  return date ? DATETIME_FMT.format(date) : fallback;
}

export function formatTime(value: Date | string | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  return date ? TIME_FMT.format(date) : fallback;
}

/** Chuỗi SLA từ số phút còn lại (âm = đã quá hạn). */
export function formatSlaCountdown(minutes: number | null): string {
  if (minutes === null) return "Chưa có hạn SLA";
  if (minutes < 0) return `Quá SLA +${Math.abs(minutes)}p`;
  return `Còn ${minutes}p`;
}

/** "HAN-SGN" → "HAN → SGN" cho hiển thị chặng bay kiểu editorial. */
export function formatRoute(route: string | null | undefined): string {
  return route && route.trim() ? route.replace(/-/g, " → ") : "—";
}
