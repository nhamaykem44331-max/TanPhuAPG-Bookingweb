// Service tìm chuyến bay cho chatbot — gọi IN-PROCESS (không qua HTTP /api/search).
//
// Vì sao in-process: /api/search giới hạn 120 req/giờ THEO IP. Bot chạy server-side
// gọi qua HTTP thì mọi khách chung 1 IP → khách này làm khách kia bị 429. Gọi thẳng
// hàm searchNamThanhFlights + markup engine tránh hoàn toàn bẫy đó; rate-limit riêng
// của bot đặt theo hội thoại (xử lý ở tầng engine).
//
// An toàn giá: nếu markup engine không load được rule (DB lỗi) → ctx.rules rỗng →
// markupApplied=false. Khi đó bot KHÔNG được báo giá (tránh lộ/ bán theo giá vốn).

import { searchNamThanhFlights } from "@/lib/namthanh";
import { getCachedVndUsdRate } from "@/lib/exchange";
import {
  loadMarkupContext,
  applyMarkupToFlights,
  applyMarkupToPairs,
} from "@/lib/pricing/searchMarkup";
import type { SearchPayload } from "@/lib/types";
import {
  toSafeFlight,
  toSafePair,
  type SafeFlight,
  type SafeRoundtripPair,
} from "./guardrail";

export interface ChatSearchResult {
  tripType: "oneway" | "roundtrip";
  /** false → markup chưa áp (DB rule lỗi hoặc không có rule). Bot KHÔNG báo giá khi false. */
  markupApplied: boolean;
  oneway: SafeFlight[];
  pairs: SafeRoundtripPair[];
  /** Hạn phiên tìm kiếm upstream — quá hạn phải search lại khi khách chốt muộn. */
  searchExpiresAt?: string;
  totalFound: number;
}

const DEFAULT_LIMIT = 6;

/**
 * Tìm chuyến cho bot: search net → cộng markup → cắt còn top N → lọc thành SafeFlight.
 * KHÔNG bao giờ trả về FlightResult thô (chứa namthanh/perPax/sources).
 */
export async function searchFlightsForChat(
  payload: SearchPayload,
  limit = DEFAULT_LIMIT,
): Promise<ChatSearchResult> {
  const raw = await searchNamThanhFlights(payload);
  const tripType: "oneway" | "roundtrip" =
    payload.tripType === "roundtrip" ? "roundtrip" : "oneway";

  let flights = raw.results ?? [];
  let pairOptions = raw.pairOptions ?? [];
  let markupApplied = false;

  try {
    const ctx = await loadMarkupContext("web", "ADT");
    // ctx.rules rỗng = DB lỗi (fail-open) hoặc chưa cấu hình rule nào → coi như CHƯA áp markup.
    // Bot sẽ không báo giá trong trường hợp này, tránh bán/ lộ giá vốn.
    if (ctx.rules.length > 0) {
      const rate = getCachedVndUsdRate();
      const engineTripType: "ONEWAY" | "ROUNDTRIP" =
        tripType === "roundtrip" ? "ROUNDTRIP" : "ONEWAY";
      const [markedFlights, markedPairs] = await Promise.all([
        applyMarkupToFlights(flights, ctx, engineTripType, rate),
        applyMarkupToPairs(pairOptions, ctx, rate),
      ]);
      flights = markedFlights;
      pairOptions = markedPairs;
      markupApplied = true;
    }
  } catch (error) {
    console.error("[chatbot/searchService] markup apply failed:", error);
    markupApplied = false;
  }

  // Sắp xếp lại theo giá đã cộng markup rồi cắt top N (markup có thể đổi thứ tự).
  const oneway =
    tripType === "oneway"
      ? flights
          .slice()
          .sort((a, b) => a.price.amount - b.price.amount)
          .slice(0, limit)
          .map(toSafeFlight)
      : [];

  const pairs =
    tripType === "roundtrip"
      ? pairOptions
          .slice()
          .sort((a, b) => a.totalAmount - b.totalAmount)
          .slice(0, limit)
          .map(toSafePair)
      : [];

  return {
    tripType,
    markupApplied,
    oneway,
    pairs,
    searchExpiresAt: raw.metadata?.expiresAt,
    totalFound: raw.metadata?.totalResults ?? flights.length,
  };
}
