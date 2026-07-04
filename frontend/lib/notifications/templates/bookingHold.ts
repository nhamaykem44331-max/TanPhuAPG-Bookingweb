import type { BookingEmailContext } from "@/lib/notifications/templates/types";

function buildInstructionLines(context: BookingEmailContext) {
  return [
    context.paymentDue ? `- Số tiền cần thanh toán: ${context.paymentDue} ${context.currency}` : null,
    context.transferContent ? `- Nội dung chuyển khoản: ${context.transferContent}` : null,
    context.accountNumber ? `- Tài khoản nhận: ${context.accountNumber}${context.accountName ? ` (${context.accountName})` : ""}` : null,
    context.checkoutUrl ? `- Link thanh toán: ${context.checkoutUrl}` : null,
  ].filter(Boolean);
}

function buildInstructionHtml(context: BookingEmailContext) {
  return [
    context.paymentDue ? `<li>Số tiền cần thanh toán: <strong>${context.paymentDue} ${context.currency}</strong></li>` : "",
    context.transferContent ? `<li>Nội dung chuyển khoản: <strong>${context.transferContent}</strong></li>` : "",
    context.accountNumber ? `<li>Tài khoản nhận: <strong>${context.accountNumber}</strong>${context.accountName ? ` (${context.accountName})` : ""}</li>` : "",
    context.checkoutUrl ? `<li>Link thanh toán: <a href="${context.checkoutUrl}">${context.checkoutUrl}</a></li>` : "",
  ].filter(Boolean).join("");
}

export function renderBookingHold(context: BookingEmailContext) {
  const subject = `[Tân Phú APG] Xác nhận giữ chỗ ${context.pnr}`;
  const instructionLines = buildInstructionLines(context);
  const text = `Xin chào ${context.customerName},

Chúng tôi đã giữ chỗ thành công cho quý khách:
- PNR: ${context.pnr}
- Hành trình: ${context.route}
- Ngày bay: ${context.departAt}
- Hành khách: ${context.passengerCount}
- Tổng tiền: ${context.sellAmount} ${context.currency}
- Hạn thanh toán: ${context.ttlExpiresAt}
${instructionLines.length > 0 ? `${instructionLines.join("\n")}\n` : ""}
Vui lòng hoàn tất thanh toán trước hạn để chúng tôi xuất vé.`;

  const html = `<p>Xin chào ${context.customerName},</p>
<p>Chúng tôi đã giữ chỗ thành công cho quý khách:</p>
<ul>
  <li>PNR: <strong>${context.pnr}</strong></li>
  <li>Hành trình: ${context.route}</li>
  <li>Ngày bay: ${context.departAt}</li>
  <li>Hành khách: ${context.passengerCount}</li>
  <li>Tổng tiền: ${context.sellAmount} ${context.currency}</li>
  <li>Hạn thanh toán: ${context.ttlExpiresAt}</li>
  ${buildInstructionHtml(context)}
</ul>
<p>Vui lòng hoàn tất thanh toán trước hạn để chúng tôi xuất vé.</p>`;

  return { subject, text, html };
}
