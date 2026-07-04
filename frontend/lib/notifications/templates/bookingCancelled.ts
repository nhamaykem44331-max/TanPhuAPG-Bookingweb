import type { BookingEmailContext } from "@/lib/notifications/templates/types";

export function renderBookingCancelled(context: BookingEmailContext & { reason: string; refundAmount?: number }) {
  const subject = `[Tân Phú APG] Booking đã hủy ${context.pnr}`;
  const refundText = context.refundAmount ? `\nSố tiền hoàn dự kiến: ${context.refundAmount.toLocaleString("vi-VN")} ${context.currency}` : "";
  const text = `Xin chào ${context.customerName},

Booking ${context.pnr} đã được ghi nhận hủy.
Lý do: ${context.reason}${refundText}`;
  const html = `<p>Xin chào ${context.customerName},</p>
<p>Booking <strong>${context.pnr}</strong> đã được ghi nhận hủy.</p>
<p>Lý do: ${context.reason}</p>
${context.refundAmount ? `<p>Số tiền hoàn dự kiến: ${context.refundAmount.toLocaleString("vi-VN")} ${context.currency}</p>` : ""}`;

  return { subject, text, html };
}
