import type { BookingEmailContext } from "@/lib/notifications/templates/types";

interface BookingPaymentReminderContext extends BookingEmailContext {
  reminderLabel: string;
}

function buildInstructionLines(context: BookingPaymentReminderContext) {
  return [
    context.paymentDue ? `- Số tiền cần thanh toán: ${context.paymentDue} ${context.currency}` : null,
    context.transferContent ? `- Nội dung chuyển khoản: ${context.transferContent}` : null,
    context.accountNumber ? `- Tài khoản nhận: ${context.accountNumber}${context.accountName ? ` (${context.accountName})` : ""}` : null,
    context.checkoutUrl ? `- Link thanh toán: ${context.checkoutUrl}` : null,
  ].filter(Boolean);
}

function buildInstructionHtml(context: BookingPaymentReminderContext) {
  return [
    context.paymentDue ? `<li>Số tiền cần thanh toán: <strong>${context.paymentDue} ${context.currency}</strong></li>` : "",
    context.transferContent ? `<li>Nội dung chuyển khoản: <strong>${context.transferContent}</strong></li>` : "",
    context.accountNumber ? `<li>Tài khoản nhận: <strong>${context.accountNumber}</strong>${context.accountName ? ` (${context.accountName})` : ""}</li>` : "",
    context.checkoutUrl ? `<li>Link thanh toán: <a href="${context.checkoutUrl}">${context.checkoutUrl}</a></li>` : "",
  ].filter(Boolean).join("");
}

export function renderBookingPaymentReminder(context: BookingPaymentReminderContext) {
  const subject = `[Tân Phú APG] Nhắc thanh toán booking ${context.pnr} - ${context.reminderLabel}`;
  const instructionLines = buildInstructionLines(context);
  const text = `Xin chào ${context.customerName},

Đây là email nhắc thanh toán cho booking ${context.pnr}.
- Hành trình: ${context.route}
- Ngày bay: ${context.departAt}
- Hạn thanh toán: ${context.ttlExpiresAt}
${instructionLines.length > 0 ? `${instructionLines.join("\n")}\n` : ""}
Vui lòng hoàn tất thanh toán trước hạn để chúng tôi giữ booking ở trạng thái sẵn sàng xuất vé.`;

  const html = `<p>Xin chào ${context.customerName},</p>
<p>Đây là email nhắc thanh toán cho booking <strong>${context.pnr}</strong>.</p>
<ul>
  <li>Hành trình: ${context.route}</li>
  <li>Ngày bay: ${context.departAt}</li>
  <li>Hạn thanh toán: ${context.ttlExpiresAt}</li>
  ${buildInstructionHtml(context)}
</ul>
<p>Vui lòng hoàn tất thanh toán trước hạn để chúng tôi giữ booking ở trạng thái sẵn sàng xuất vé.</p>`;

  return { subject, text, html };
}
