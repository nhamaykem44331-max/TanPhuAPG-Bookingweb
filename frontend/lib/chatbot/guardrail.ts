// Guardrail bảo mật cho chatbot AI.
//
// Nguyên tắc: model AI và khách hàng CHỈ được thấy dữ liệu an toàn. Mọi thông tin
// nhà cung cấp cấp 1 (đại lý "Nam Thành" / hệ thống "muadi"), giá vốn (net / perPax),
// nguồn dữ liệu (sources) TUYỆT ĐỐI không được rò ra ngoài.
//
// Hai lớp chặn:
//   1. toSafeFlight/toSafePair — cắt dữ liệu ở tầng dữ liệu TRƯỚC khi đưa vào model
//      (guard chính, không phụ thuộc model có "ngoan" hay không).
//   2. filterBotOutput — quét văn bản model sinh ra trước khi gửi khách (backstop).

import type { FlightResult, RoundtripPairOption } from "@/lib/types";

/**
 * Chuyến bay đã lọc — chỉ chứa thông tin an toàn để đưa cho model và hiển thị cho khách.
 * `price` là GIÁ BÁN (đã cộng markup) cho 1 người lớn. Không có perPax/net/namthanh.
 */
export interface SafeFlight {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  from: { airport: string; city: string; time: string };
  to: { airport: string; city: string; time: string };
  durationMinutes: number;
  stops: number;
  price: number;
}

/** Cặp khứ hồi đã lọc — totalPrice là tổng giá BÁN cả 2 chiều cho 1 người lớn. */
export interface SafeRoundtripPair {
  outbound: SafeFlight;
  inbound: SafeFlight;
  totalPrice: number;
  airlines: string[];
}

export function toSafeFlight(flight: FlightResult): SafeFlight {
  return {
    airline: flight.airline,
    airlineCode: flight.airlineCode,
    flightNumber: flight.flightNumber,
    from: {
      airport: flight.departure.airport,
      city: flight.departure.city,
      time: flight.departure.time,
    },
    to: {
      airport: flight.arrival.airport,
      city: flight.arrival.city,
      time: flight.arrival.time,
    },
    durationMinutes: flight.duration,
    stops: flight.stops,
    price: flight.price.amount,
  };
}

export function toSafePair(pair: RoundtripPairOption): SafeRoundtripPair {
  return {
    outbound: toSafeFlight(pair.outbound),
    inbound: toSafeFlight(pair.inbound),
    totalPrice: pair.totalAmount,
    airlines: pair.airlines,
  };
}

// ─── Backstop: quét văn bản model sinh ra ────────────────────────────────────

// Các mẫu tên nhà cung cấp cần chặn. Input-side stripping là bảo đảm chính;
// đây là lớp phòng hờ nếu tên lọt vào qua ngả khác (khách tự nhắc, v.v.).
// Lưu ý: chỉ chặn token hệ thống "muadi" liền (không dấu cách) — KHÔNG chặn
// "mua đi"/"mua di" có dấu cách vì đó là tiếng Việt thường ("hãy mua"), bot dùng hợp lệ.
const SUPPLIER_REDACT_PATTERNS: RegExp[] = [
  /nam\s*th[àáảãạăâ]nh/gi, // "Nam Thành", "Nam Thánh"...
  /nam\s*thanh/gi, // "Nam Thanh", "namthanh" (có/không dấu cách)
  /namthanh/gi,
  /\bmuadi\b/gi, // id hệ thống nhà cung cấp
];

const SUPPLIER_REPLACEMENT = "đối tác";

/** Chuẩn hóa bỏ dấu tiếng Việt để dò khớp không phụ thuộc dấu. */
function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Có xuất hiện tên nhà cung cấp trong văn bản không (dò cả bản bỏ dấu). */
export function containsSupplierLeak(text: string): boolean {
  const ascii = stripDiacritics(text).toLowerCase();
  if (/nam\s*thanh/.test(ascii)) return true;
  if (/\bmuadi\b/.test(ascii)) return true;
  return SUPPLIER_REDACT_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Lọc văn bản bot trước khi gửi khách: thay tên nhà cung cấp bằng "đối tác".
 * Trả về text đã lọc + cờ leaked để tầng gọi ghi log / cảnh báo nội bộ.
 */
export function filterBotOutput(text: string): { text: string; leaked: boolean } {
  let leaked = false;
  let out = text;
  for (const re of SUPPLIER_REDACT_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(out)) {
      leaked = true;
      re.lastIndex = 0;
      out = out.replace(re, SUPPLIER_REPLACEMENT);
    }
  }
  return { text: out, leaked };
}
