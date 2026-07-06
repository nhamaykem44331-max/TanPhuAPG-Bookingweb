import { flightLegLines, type FlightLegSummary } from "@/lib/notifications/flightSummary";
import type { BookingEmailContext } from "@/lib/notifications/templates/types";

// Map BIN → tên ngân hàng thân thiện (hiển thị trong email). Không khớp thì bỏ dòng ngân hàng
// (QR compact2 vẫn hiện logo/ngân hàng), tuyệt đối không đoán sai tên.
const BANK_BY_BIN: Record<string, string> = {
  "970415": "VietinBank",
  "970436": "Vietcombank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970407": "Techcombank",
  "970422": "MB Bank",
  "970416": "ACB",
  "970432": "VPBank",
  "970403": "Sacombank",
  "970423": "TPBank",
  "970431": "Eximbank",
  "970437": "HDBank",
  "970443": "SHB",
  "970426": "MSB",
  "970448": "OCB",
  "970441": "VIB",
  "970440": "SeABank",
  "970449": "LPBank",
  "970454": "BVBank",
};

const NAVY = "#0C2740";
const GOLD_TEXT = "#E3C77A";

function bankLabel(bin?: string | null): string | null {
  if (!bin) return null;
  return BANK_BY_BIN[bin.trim()] ?? null;
}

function infoRow(label: string, value: string, opts: { strong?: boolean; mono?: boolean } = {}): string {
  const valStyle = `padding:7px 0;text-align:right;font-size:13px;color:#16212B;${opts.strong ? "font-weight:bold;" : ""}${opts.mono ? "font-family:'Courier New',monospace;" : ""}`;
  return `<tr>
    <td style="padding:7px 0;font-size:13px;color:#7A8794;white-space:nowrap;">${label}</td>
    <td style="${valStyle}">${value}</td>
  </tr>`;
}

function legCard(leg: FlightLegSummary): string {
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

export function renderBookingHold(context: BookingEmailContext) {
  const subject = `[Tân Phú APG] Xác nhận giữ chỗ ${context.pnr}`;
  const hasLegs = Array.isArray(context.flightLegs) && context.flightLegs.length > 0;

  // ---------- Plain text (fallback) ----------
  const textLines = [
    `Xin chào ${context.customerName},`,
    "",
    "Chúng tôi đã giữ chỗ thành công cho quý khách:",
    context.orderCode ? `- Mã đơn: ${context.orderCode}` : null,
    `- PNR: ${context.pnr}`,
    ...(hasLegs
      ? ["- Chuyến bay:", ...flightLegLines(context.flightLegs!).map((line) => `   • ${line}`)]
      : [`- Hành trình: ${context.route}`, `- Ngày bay: ${context.departAt}`]),
    `- Hành khách: ${context.passengerCount}`,
    `- Tổng tiền: ${context.sellAmount} ${context.currency}`,
    `- Hạn thanh toán: ${context.ttlExpiresAt}`,
    "",
    "THANH TOÁN:",
    context.paymentDue ? `- Số tiền: ${context.paymentDue} ${context.currency}` : null,
    context.accountNumber ? `- Số tài khoản: ${context.accountNumber}${context.accountName ? ` (${context.accountName})` : ""}` : null,
    context.transferContent ? `- Nội dung chuyển khoản (GIỮ NGUYÊN): ${context.transferContent}` : null,
    context.checkoutUrl ? `- Thanh toán / xem QR: ${context.checkoutUrl}` : null,
    "",
    `Vui lòng hoàn tất thanh toán trước hạn để chúng tôi xuất vé.`,
    context.lookupUrl ? `Xem lại đơn & tải mặt vé tại: ${context.lookupUrl}${context.orderCode ? ` (mã đơn ${context.orderCode} + số điện thoại)` : ""}` : null,
    "",
    "Hotline 0918.752.686 · zalo.me/0918752686 · Tân Phú APG",
  ].filter((l) => l !== null);
  const text = textLines.join("\n");

  // ---------- HTML (email-safe, table-based, inline styles) ----------
  const bank = bankLabel(context.bankName);
  const bankRows = [
    bank ? infoRow("Ngân hàng", bank, { strong: true }) : "",
    context.accountNumber ? infoRow("Số tài khoản", context.accountNumber, { strong: true, mono: true }) : "",
    context.accountName ? infoRow("Chủ tài khoản", context.accountName, { strong: true }) : "",
    context.transferContent
      ? `<tr><td style="padding:7px 0;font-size:13px;color:#7A8794;white-space:nowrap;">Nội dung CK</td><td style="padding:7px 0;text-align:right;"><span style="font-family:'Courier New',monospace;font-weight:bold;font-size:13px;color:${NAVY};background:#EAF2FA;padding:3px 8px;border-radius:4px;">${context.transferContent}</span></td></tr>`
      : "",
  ].join("");

  const qrBlock = context.qrImageUrl
    ? `<tr><td align="center" style="padding:6px 0 2px;">
        <img src="${context.qrImageUrl}" alt="Mã QR thanh toán VietQR" width="230" style="display:block;width:230px;max-width:100%;border:1px solid #ECE7D8;border-radius:10px;" />
        <div style="margin-top:6px;font-size:12px;color:#586675;">Mở app ngân hàng → quét mã để thanh toán</div>
      </td></tr>`
    : "";

  const payButton = context.checkoutUrl
    ? `<tr><td align="center" style="padding:14px 0 2px;">
        <a href="${context.checkoutUrl}" style="display:inline-block;background:#1F7A54;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:9px;font-size:15px;font-weight:bold;">Thanh toán ngay &rarr;</a>
        <div style="margin-top:7px;font-size:11.5px;color:#93A0AC;">Hoặc chuyển khoản theo thông tin bên dưới</div>
      </td></tr>`
    : "";

  const lookupBlock = context.lookupUrl
    ? `<tr><td style="padding:6px 28px 18px;font-size:13px;color:#586675;line-height:1.6;">
        Xem lại đơn &amp; tải mặt vé bất cứ lúc nào tại
        <a href="${context.lookupUrl}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">Chuyến bay của tôi</a>${context.orderCode ? ` (mã đơn <strong>${context.orderCode}</strong> + số điện thoại)` : ""}.
      </td></tr>`
    : "";

  const html = `<div style="background:#EEF1F4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:100%;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(16,24,40,.08);">
    <tr>
      <td style="background:${NAVY};padding:20px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td>
            <div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.3px;">TÂN PHÚ APG</div>
            <div style="color:rgba(255,255,255,.62);font-size:11.5px;margin-top:2px;">Corporate Aviation Services</div>
          </td>
          <td align="right" style="white-space:nowrap;">
            <span style="display:inline-block;background:#FDF0DD;color:#854F0B;border:1px solid #EF9F27;border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:bold;">GIỮ CHỖ · CHỜ THANH TOÁN</span>
          </td>
        </tr></table>
      </td>
    </tr>

    <tr><td style="padding:22px 28px 6px;">
      <div style="font-size:15px;color:#16212B;">Xin chào <strong>${context.customerName}</strong>,</div>
      <div style="margin-top:6px;font-size:14px;color:#586675;line-height:1.6;">Chúng tôi đã <strong style="color:${NAVY};">giữ chỗ thành công</strong> cho quý khách. Vui lòng hoàn tất thanh toán trước hạn để được xuất vé.</div>
    </td></tr>

    <tr><td style="padding:10px 28px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E5E9EE;border-radius:10px;">
        <tr><td style="padding:6px 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${context.orderCode ? infoRow("Mã đơn", context.orderCode, { strong: true, mono: true }) : ""}
            ${infoRow("PNR", context.pnr, { strong: true, mono: true })}
            ${hasLegs ? "" : infoRow("Hành trình", context.route)}
            ${hasLegs ? "" : infoRow("Ngày bay", context.departAt)}
            ${infoRow("Hành khách", String(context.passengerCount))}
            ${infoRow("Tổng tiền", `${context.sellAmount} ${context.currency}`, { strong: true })}
            ${infoRow("Hạn thanh toán", context.ttlExpiresAt, { strong: true })}
          </table>
        </td></tr>
      </table>
    </td></tr>

    ${hasLegs ? `<tr><td style="padding:12px 28px 2px;">
      <div style="font-size:11px;color:#7A8794;text-transform:uppercase;letter-spacing:.7px;margin:0 0 7px;">Chi tiết chuyến bay</div>
      ${context.flightLegs!.map(legCard).join("")}
    </td></tr>` : ""}

    <tr><td style="padding:14px 28px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5FAF7;border:1px solid #CDEBD9;border-radius:12px;">
        <tr><td style="padding:18px 20px;">
          <div style="text-align:center;font-size:11.5px;color:#3B6D57;text-transform:uppercase;letter-spacing:1px;">Số tiền cần thanh toán</div>
          <div style="text-align:center;font-size:27px;font-weight:bold;color:#0F7B43;margin-top:3px;">${context.paymentDue ?? context.sellAmount} ${context.currency}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${qrBlock}
            ${payButton}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;border-top:1px dashed #C9DCEC;padding-top:6px;">
            ${bankRows}
          </table>
          ${context.transferContent ? `<div style="margin-top:8px;font-size:11.5px;color:#854F0B;background:#FDF0DD;border-radius:6px;padding:7px 10px;">Giữ nguyên nội dung chuyển khoản để hệ thống <strong>tự động đối soát &amp; xuất vé</strong>.</div>` : ""}
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:12px 28px 2px;">
      <div style="background:#FDF0DD;border:1px solid #EF9F27;border-radius:8px;padding:10px 14px;font-size:13px;color:#854F0B;">
        &#9200; Thanh toán trước <strong>${context.ttlExpiresAt}</strong> — quá hạn vé sẽ tự động huỷ.
      </div>
    </td></tr>

    ${lookupBlock}

    <tr><td style="background:${NAVY};padding:18px 28px;text-align:center;">
      <div style="color:${GOLD_TEXT};font-weight:bold;font-size:13px;letter-spacing:.4px;">TÂN PHÚ APG</div>
      <div style="margin-top:7px;font-size:12.5px;color:rgba(255,255,255,.82);">
        Hotline <a href="tel:0918752686" style="color:#ffffff;text-decoration:none;font-weight:bold;">0918.752.686</a>
        &nbsp;·&nbsp;
        <a href="https://zalo.me/0918752686" style="color:#ffffff;text-decoration:underline;">Chat Zalo</a>
      </div>
      <div style="margin-top:5px;font-size:11.5px;color:rgba(255,255,255,.55);">Đại lý cấp 1 Amadeus GDS · MST 4600111735</div>
    </td></tr>
  </table>
</div>`;

  return { subject, text, html };
}
