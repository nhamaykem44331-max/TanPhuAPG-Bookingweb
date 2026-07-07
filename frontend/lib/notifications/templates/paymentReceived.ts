import { flightLegLines, type FlightLegSummary } from "@/lib/notifications/flightSummary";

const NAVY = "#0C2740";
const GREEN = "#0F7B43";
const GOLD_TEXT = "#E3C77A";

export interface PaymentReceivedContext {
  customerName: string;
  orderCode: string | null;
  pnr: string;
  flightLegs: FlightLegSummary[];
  paidAmount: string; // đã format
  currency: string;
  lookupUrl?: string | null;
}

function legRow(leg: FlightLegSummary): string {
  const isReturn = leg.direction === "inbound";
  const accent = isReturn ? NAVY : "#C2740F";
  const tag = isReturn ? "CHIỀU VỀ" : "CHIỀU ĐI";
  const timeRange = leg.departTime ? `${leg.departTime}${leg.arriveTime ? ` &rarr; ${leg.arriveTime}` : ""}` : "";
  const sub = [leg.airline, leg.flightNumber].filter(Boolean).join(" · ");
  const whenLine = [timeRange ? `<strong>${timeRange}</strong>` : "", leg.dateLabel ?? ""].filter(Boolean).join(" · ");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E9EE;border-left:3px solid ${accent};border-radius:8px;margin-bottom:8px;">
    <tr><td style="padding:9px 13px;">
      <div style="font-size:10.5px;font-weight:bold;letter-spacing:.6px;color:${accent};">${tag}</div>
      <div style="font-size:15px;font-weight:bold;color:#16212B;margin-top:2px;">${leg.route}</div>
      ${sub ? `<div style="font-size:12.5px;color:#586675;margin-top:2px;">${sub}</div>` : ""}
      ${whenLine ? `<div style="font-size:13px;color:#16212B;margin-top:3px;">${whenLine}</div>` : ""}
    </td></tr>
  </table>`;
}

export function renderPaymentReceived(context: PaymentReceivedContext) {
  const subject = `[Tân Phú APG] Đã nhận thanh toán ${context.pnr} — đang xuất vé`;
  const hasLegs = context.flightLegs.length > 0;

  const textLines = [
    `Xin chào ${context.customerName},`,
    "",
    `Chúng tôi đã nhận đủ thanh toán ${context.paidAmount} ${context.currency} cho đơn ${context.orderCode ?? context.pnr}.`,
    `PNR: ${context.pnr}`,
    ...(hasLegs ? ["Chuyến bay:", ...flightLegLines(context.flightLegs).map((line) => `   • ${line}`)] : []),
    "",
    "Vé đang được xuất và sẽ gửi tới quý khách ngay khi hoàn tất.",
    context.lookupUrl ? `Xem lại đơn & tải vé: ${context.lookupUrl}${context.orderCode ? ` (mã đơn ${context.orderCode} + số điện thoại)` : ""}` : null,
    "",
    "Cảm ơn quý khách. Hotline 0918.752.686 · Tân Phú APG",
  ].filter((line) => line !== null);
  const text = textLines.join("\n");

  const html = `<div style="background:#EEF1F4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:100%;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(16,24,40,.08);">
    <tr><td style="background:${NAVY};padding:20px 28px;">
      <div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.3px;">TÂN PHÚ APG</div>
      <div style="color:rgba(255,255,255,.62);font-size:11.5px;margin-top:2px;">Corporate Aviation Services</div>
    </td></tr>

    <tr><td align="center" style="padding:26px 28px 6px;">
      <div style="display:inline-block;background:#EBFBF2;border:1px solid #A7E8C7;color:${GREEN};border-radius:24px;padding:7px 18px;font-size:13px;font-weight:bold;">&#10003; ĐÃ NHẬN THANH TOÁN</div>
      <div style="margin-top:14px;font-size:15px;color:#16212B;">Xin chào <strong>${context.customerName}</strong>,</div>
      <div style="margin-top:6px;font-size:14px;color:#586675;line-height:1.6;">Chúng tôi đã nhận đủ thanh toán. Vé của quý khách <strong style="color:${NAVY};">đang được xuất</strong> và sẽ gửi tới quý khách ngay khi hoàn tất.</div>
    </td></tr>

    <tr><td style="padding:14px 28px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5FAF7;border:1px solid #CDEBD9;border-radius:12px;">
        <tr><td style="padding:16px 20px;text-align:center;">
          <div style="font-size:11.5px;color:#3B6D57;text-transform:uppercase;letter-spacing:1px;">Số tiền đã thanh toán</div>
          <div style="font-size:27px;font-weight:bold;color:${GREEN};margin-top:3px;">${context.paidAmount} ${context.currency}</div>
          <div style="margin-top:4px;font-size:12.5px;color:#586675;">Mã đơn ${context.orderCode ?? "-"} · PNR <strong>${context.pnr}</strong></div>
        </td></tr>
      </table>
    </td></tr>

    ${hasLegs ? `<tr><td style="padding:12px 28px 2px;">
      <div style="font-size:11px;color:#7A8794;text-transform:uppercase;letter-spacing:.7px;margin:0 0 7px;">Chi tiết chuyến bay</div>
      ${context.flightLegs.map(legRow).join("")}
    </td></tr>` : ""}

    ${context.lookupUrl ? `<tr><td style="padding:6px 28px 18px;font-size:13px;color:#586675;line-height:1.6;">
      Xem lại đơn &amp; tải vé tại
      <a href="${context.lookupUrl}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">Chuyến bay của tôi</a>${context.orderCode ? ` (mã đơn <strong>${context.orderCode}</strong> + số điện thoại)` : ""}.
    </td></tr>` : ""}

    <tr><td style="background:${NAVY};padding:18px 28px;text-align:center;">
      <div style="color:${GOLD_TEXT};font-weight:bold;font-size:13px;letter-spacing:.4px;">TÂN PHÚ APG</div>
      <div style="margin-top:7px;font-size:12.5px;color:rgba(255,255,255,.82);">
        Hotline <a href="tel:0918752686" style="color:#ffffff;text-decoration:none;font-weight:bold;">0918.752.686</a>
        &nbsp;·&nbsp;
        <a href="https://zalo.me/0918752686" style="color:#ffffff;text-decoration:underline;">Chat Zalo</a>
      </div>
    </td></tr>
  </table>
</div>`;

  return { subject, text, html };
}
