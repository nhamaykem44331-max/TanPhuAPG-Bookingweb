import type { BookingEmailContext } from "@/lib/notifications/templates/types";

export function renderBookingIssued(context: BookingEmailContext & { ticketNumbers?: Array<{ passengerName: string; ticketNumber: string }> }) {
  const subject = `[Tân Phú APG] Vé đã được xuất ${context.pnr}`;
  const tickets = context.ticketNumbers?.length
    ? context.ticketNumbers.map((ticket) => `- ${ticket.passengerName}: ${ticket.ticketNumber}`).join("\n")
    : "- Số vé sẽ được cập nhật trong hành trình.";
  const text = `Xin chào ${context.customerName},

Booking ${context.pnr} đã được ghi nhận xuất vé.

${tickets}

Hành trình: ${context.route}
Ngày bay: ${context.departAt}`;
  const htmlTickets = context.ticketNumbers?.length
    ? `<ul>${context.ticketNumbers.map((ticket) => `<li>${ticket.passengerName}: <strong>${ticket.ticketNumber}</strong></li>`).join("")}</ul>`
    : "<p>Số vé sẽ được cập nhật trong hành trình.</p>";
  const html = `<p>Xin chào ${context.customerName},</p>
<p>Booking <strong>${context.pnr}</strong> đã được ghi nhận xuất vé.</p>
${htmlTickets}
<p>Hành trình: ${context.route}<br/>Ngày bay: ${context.departAt}</p>`;

  return { subject, text, html };
}
