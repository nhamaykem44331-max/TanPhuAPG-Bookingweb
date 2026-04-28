/**
 * POST /api/n8n/quote
 * Tạo báo giá tổng hợp dạng text/markdown để gửi qua Telegram/Zalo/Email
 *
 * Body:
 * {
 *   "outbound": { "from":"HAN","to":"SGN","date":"2026-03-25","flightNumber":"VJ445","airline":"VietJet Air","departureTime":"17:40","arrivalTime":"19:45","price":1010000 },
 *   "inbound":  { ... },   // optional — khứ hồi
 *   "adults": 1, "children": 0, "infants": 0,
 *   "cabin": "economy",
 *   "format": "telegram"   // "telegram" | "plain" | "html"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { getVndUsdRate } from '@/lib/exchange';

export const runtime = 'nodejs';

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

function longDate(dateStr: string) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  const days = ['CN','T.Hai','T.Ba','T.Tư','T.Năm','T.Sáu','T.Bảy'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

interface FlightInput {
  from: string; to: string; date: string;
  flightNumber: string; airline: string;
  departureTime: string; arrivalTime: string;
  price: number; stops?: number;
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }

  const outbound  = body.outbound  as FlightInput | undefined;
  const inbound   = body.inbound   as FlightInput | undefined;
  const adults    = Number(body.adults ?? 1);
  const children  = Number(body.children ?? 0);
  const infants   = Number(body.infants ?? 0);
  const cabin     = String(body.cabin || 'economy');
  const format    = String(body.format || 'telegram');

  if (!outbound) return NextResponse.json({ error: '"outbound" là bắt buộc' }, { status: 400 });

  const cabinLabel: Record<string, string> = {
    economy: 'Phổ thông', premium: 'Phổ thông đặc biệt',
    business: 'Thương gia', first: 'Hạng nhất',
  };

  // Tính giá
  const outPrice  = Number(outbound.price);
  const inPrice   = Number(inbound?.price ?? 0);
  const farePerPax = outPrice + inPrice;
  const totalAdults   = farePerPax * adults;
  const totalChildren = farePerPax * 0.75 * children;
  const totalInfants  = farePerPax * 0.1  * infants;
  const taxEst        = Math.round(totalAdults * 0.12);
  const grandTotal    = Math.round(totalAdults + totalChildren + totalInfants + taxEst);
  const isRoundtrip   = !!inbound;
  const usdRate       = await getVndUsdRate();
  const grandTotalUSD = Math.round(grandTotal / usdRate);

  const quoteId = `APG-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // ── Telegram format ──────────────────────────────────────────
  let telegramText = '';
  if (format === 'telegram') {
    telegramText =
`✈️ *BÁO GIÁ VÉ MÁY BAY*
📋 Mã: \`${quoteId}\`
━━━━━━━━━━━━━━━━━━━━

📍 *${isRoundtrip ? 'CHIỀU ĐI' : 'CHUYẾN BAY'}*
🛫 ${outbound.from} → ${outbound.to} | ${longDate(outbound.date)}
✈ ${outbound.airline} · ${outbound.flightNumber}
⏰ ${outbound.departureTime} → ${outbound.arrivalTime}${outbound.stops === 0 ? ' · Bay thẳng' : ''}
💰 ${fmt(outPrice)}/người${inbound ? `
━━━━━━━━━━━━━━━━━━━━

📍 *CHIỀU VỀ*
🛬 ${inbound.from} → ${inbound.to} | ${longDate(inbound.date)}
✈ ${inbound.airline} · ${inbound.flightNumber}
⏰ ${inbound.departureTime} → ${inbound.arrivalTime}${inbound.stops === 0 ? ' · Bay thẳng' : ''}
💰 ${fmt(inPrice)}/người` : ''}
━━━━━━━━━━━━━━━━━━━━

👥 *Hành khách*
• Người lớn: ${adults}${children > 0 ? `\n• Trẻ em: ${children}` : ''}${infants > 0 ? `\n• Em bé: ${infants}` : ''}
🎫 Hạng: ${cabinLabel[cabin] || cabin}

💵 *Chi tiết giá*
• Vé người lớn × ${adults}: ${fmt(totalAdults)}${children > 0 ? `\n• Vé trẻ em × ${children}: ${fmt(totalChildren)}` : ''}${infants > 0 ? `\n• Vé em bé × ${infants}: ${fmt(totalInfants)}` : ''}
• Thuế + phí (ước tính): ${fmt(taxEst)}

🔴 *TỔNG GIÁ: ${fmt(grandTotal)}*
_(≈ $${grandTotalUSD} USD)_

━━━━━━━━━━━━━━━━━━━━
📞 Đặt vé: *0918.752.686* (Zalo/Call)
🌐 tanphuapg.com
⚠️ _Giá tham khảo, liên hệ xác nhận chính xác_`;
  }

  // ── Plain text format ────────────────────────────────────────
  let plainText = '';
  if (format === 'plain') {
    plainText =
`BÁO GIÁ VÉ MÁY BAY - TAN PHU APG
Mã báo giá: ${quoteId}

${isRoundtrip ? 'CHIỀU ĐI' : 'CHUYẾN BAY'}: ${outbound.from} → ${outbound.to}
Ngày: ${longDate(outbound.date)}
Chuyến: ${outbound.airline} ${outbound.flightNumber}
Giờ bay: ${outbound.departureTime} → ${outbound.arrivalTime}
Giá/người: ${fmt(outPrice)}
${inbound ? `
CHIỀU VỀ: ${inbound.from} → ${inbound.to}
Ngày: ${longDate(inbound.date)}
Chuyến: ${inbound.airline} ${inbound.flightNumber}
Giờ bay: ${inbound.departureTime} → ${inbound.arrivalTime}
Giá/người: ${fmt(inPrice)}
` : ''}
TỔNG GIÁ: ${fmt(grandTotal)}
(Người lớn: ${adults}, Trẻ em: ${children}, Em bé: ${infants} - Hạng: ${cabinLabel[cabin] || cabin})

Liên hệ đặt vé: 0918.752.686 | tanphuapg.com | tkt.tanphu@gmail.com
* Giá tham khảo, vui lòng liên hệ xác nhận chính xác.`;
  }

  // ── JSON data (luôn trả về) ──────────────────────────────────
  return NextResponse.json({
    success: true,
    quoteId,
    isRoundtrip,
    passengers: { adults, children, infants },
    cabin: cabinLabel[cabin] || cabin,
    pricing: {
      outboundPerPax:  outPrice,
      inboundPerPax:   inPrice,
      farePerPax,
      totalFareAdults: Math.round(totalAdults),
      totalFareChildren: Math.round(totalChildren),
      totalFareInfants:  Math.round(totalInfants),
      taxEstimate:     taxEst,
      grandTotal,
      grandTotalUSD,
      usdRate,
    },
    outbound,
    inbound: inbound || null,
    // Tin nhắn sẵn sàng gửi
    telegramText:  format === 'telegram' ? telegramText : undefined,
    plainText:     format === 'plain'    ? plainText    : undefined,
    // Luôn có cả 2
    messages: { telegram: telegramText || buildTelegram(outbound, inbound, adults, children, infants, cabin, cabinLabel, outPrice, inPrice, totalAdults, totalChildren, totalInfants, taxEst, grandTotal, quoteId, isRoundtrip, grandTotalUSD), plain: plainText },
  });
}

function buildTelegram(
  outbound: FlightInput, inbound: FlightInput | undefined,
  adults: number, children: number, infants: number,
  cabin: string, cabinLabel: Record<string, string>,
  outPrice: number, inPrice: number,
  totalAdults: number, totalChildren: number, totalInfants: number,
  taxEst: number, grandTotal: number,
  quoteId: string, isRoundtrip: boolean,
  grandTotalUSD: number
): string {
  const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
  return `✈️ *BÁO GIÁ VÉ MÁY BAY*\n📋 Mã: \`${quoteId}\`\n\n📍 *${isRoundtrip ? 'CHIỀU ĐI' : 'CHUYẾN BAY'}*: ${outbound.from}→${outbound.to} | ${longDate(outbound.date)}\n✈ ${outbound.airline} ${outbound.flightNumber} | ${outbound.departureTime}→${outbound.arrivalTime}\n💰 ${fmt(outPrice)}/người\n${inbound ? `\n📍 *CHIỀU VỀ*: ${inbound.from}→${inbound.to} | ${longDate(inbound.date)}\n✈ ${inbound.airline} ${inbound.flightNumber} | ${inbound.departureTime}→${inbound.arrivalTime}\n💰 ${fmt(inPrice)}/người\n` : ''}\n👥 ${adults} NL${children > 0 ? ` · ${children} TE` : ''}${infants > 0 ? ` · ${infants} EB` : ''} · ${cabinLabel[cabin] || cabin}\n\n🔴 *TỔNG: ${fmt(grandTotal)}* (≈$${grandTotalUSD})\n\n📞 *0918.752.686* | tanphuapg.com\n⚠️ _Giá tham khảo_`;
}
