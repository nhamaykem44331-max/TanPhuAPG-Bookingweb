import prismaClient from "@prisma/client";

import type { FlightResult, RoundtripPairOption } from "@/lib/types";
import { computeMarkup, type CompatibleMarkupRule } from "./markupEngine";

const { Prisma } = prismaClient;

const RULES_TTL_MS = 60_000;
const AIRPORT_INDEX_TTL_MS = 5 * 60_000;

let cachedRulesPromise: Promise<CompatibleMarkupRule[]> | null = null;
let cachedRulesAt = 0;
let cachedAirportIndexPromise: Promise<Map<string, boolean> | null> | null = null;
let cachedAirportIndexAt = 0;

const DEFAULT_BACKEND_URL = "http://localhost:3100";

function backendUrl() {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

function backendHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers["X-API-Key"] = key;
  return { ...headers, ...extra };
}

async function loadActiveRules(): Promise<CompatibleMarkupRule[]> {
  const now = Date.now();
  if (cachedRulesPromise && now - cachedRulesAt < RULES_TTL_MS) {
    return cachedRulesPromise;
  }
  cachedRulesAt = now;
  cachedRulesPromise = (async () => {
    try {
      const { prisma } = await import("../db");
      return await prisma.markupRule.findMany({
        where: { active: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
    } catch (error) {
      // Fail-open: DB không kết nối được hoặc test env không có DB → trả mảng rỗng
      // → không cộng markup, search vẫn trả về giá net (better than blocking)
      if (process.env.NODE_ENV !== "test") {
        console.error("[searchMarkup] loadActiveRules failed:", error);
      }
      return [];
    }
  })();
  return cachedRulesPromise;
}

interface AirportRecord {
  code: string;
  domestic?: boolean;
}

async function loadAirportIndex(): Promise<Map<string, boolean> | null> {
  const now = Date.now();
  if (cachedAirportIndexPromise && now - cachedAirportIndexAt < AIRPORT_INDEX_TTL_MS) {
    return cachedAirportIndexPromise;
  }
  cachedAirportIndexAt = now;
  cachedAirportIndexPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${backendUrl()}/airports`, {
        method: "GET",
        headers: backendHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as { airports?: AirportRecord[] } | null;
      if (!response.ok || !Array.isArray(payload?.airports)) return null;
      return new Map(payload.airports.map((airport) => [airport.code.toUpperCase(), !!airport.domestic]));
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })().catch(() => null);
  return cachedAirportIndexPromise;
}

export function clearSearchMarkupCache() {
  cachedRulesPromise = null;
  cachedAirportIndexPromise = null;
  cachedRulesAt = 0;
  cachedAirportIndexAt = 0;
}

export function classifyDomestic(from: string | undefined | null, to: string | undefined | null, airports: Map<string, boolean> | null): "DOMESTIC" | "INTERNATIONAL" | null {
  if (!airports || !from || !to) return null;
  const f = airports.get(from.toUpperCase());
  const t = airports.get(to.toUpperCase());
  if (f === true && t === true) return "DOMESTIC";
  if (f !== undefined && t !== undefined) return "INTERNATIONAL";
  return null;
}

export interface MarkupContext {
  rules: CompatibleMarkupRule[];
  airports: Map<string, boolean> | null;
  channel: string;
  paxType: string;
}

export async function loadMarkupContext(channel = "web", paxType = "ADT"): Promise<MarkupContext> {
  const [rules, airports] = await Promise.all([loadActiveRules(), loadAirportIndex()]);
  return { rules, airports, channel, paxType };
}

async function computeForFlight(flight: FlightResult, ctx: MarkupContext, tripType: "ONEWAY" | "ROUNDTRIP"): Promise<{ sellPrice: number; markupAmount: number; ruleId: string | null }> {
  const netAmount = Number(flight.fareBreakdown?.totalAmount ?? flight.price?.amount ?? 0);
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    return { sellPrice: 0, markupAmount: 0, ruleId: null };
  }
  const dom = classifyDomestic(flight.departure?.airport, flight.arrival?.airport, ctx.airports);
  const route = flight.departure?.airport && flight.arrival?.airport
    ? `${flight.departure.airport}-${flight.arrival.airport}`
    : null;
  const fareClass = flight.namthanh?.cabinClass ?? flight.namthanh?.class ?? null;

  const result = await computeMarkup(
    {
      airline: flight.airlineCode || "",
      channel: ctx.channel,
      fareClass,
      paxType: ctx.paxType,
      domesticInternational: dom,
      tripType,
      route,
      netPrice: new Prisma.Decimal(netAmount),
    },
    ctx.rules,
  );

  return {
    sellPrice: Number(result.sellPrice.toString()),
    markupAmount: Number(result.markupAmount.toString()),
    ruleId: result.ruleId,
  };
}

function applyPriceToFlight(flight: FlightResult, sellPrice: number, exchangeRate?: number | null): FlightResult {
  const netAmount = Number(flight.fareBreakdown?.totalAmount ?? flight.price?.amount ?? 0);
  if (!Number.isFinite(sellPrice) || sellPrice <= 0 || sellPrice === netAmount) return flight;

  // Cập nhật price.amount (giá khách thấy) — khách thấy giá đã cộng markup
  const nextPrice = { ...flight.price, amount: sellPrice };

  // Cập nhật fareBreakdown — giữ nguyên baseAmount/taxesFees từ Nam Thanh, tăng totalAmount
  // (markup được hiểu là phần "service charge" cộng thêm; không tách thành line riêng để đơn giản UI)
  const nextFareBreakdown = flight.fareBreakdown
    ? { ...flight.fareBreakdown, totalAmount: sellPrice }
    : { baseAmount: netAmount, taxesFees: 0, totalAmount: sellPrice, currency: "VND" as const };

  // Recalc priceUSD nếu có rate sẵn
  const priceUSD = typeof exchangeRate === "number" && exchangeRate > 0
    ? Math.round(sellPrice / exchangeRate)
    : flight.priceUSD;

  // fareOptions cần đồng bộ (nếu có) — để selected fare matching ổn định
  const nextFareOptions = flight.fareOptions
    ? flight.fareOptions.map((option) => {
        const optionTotal = Number(option.fareBreakdown?.totalAmount ?? option.totalAmount ?? 0);
        if (!Number.isFinite(optionTotal) || optionTotal <= 0) return option;
        // Chỉ chỉnh option đang được chọn (có amount = netAmount), các option khác giữ nguyên net để fare picker có thông tin so sánh net
        if (Math.abs(optionTotal - netAmount) < 1) {
          return {
            ...option,
            totalAmount: sellPrice,
            fareBreakdown: option.fareBreakdown
              ? { ...option.fareBreakdown, totalAmount: sellPrice }
              : option.fareBreakdown,
          };
        }
        return option;
      })
    : flight.fareOptions;

  return {
    ...flight,
    price: nextPrice,
    fareBreakdown: nextFareBreakdown,
    priceUSD,
    fareOptions: nextFareOptions,
  };
}

export async function applyMarkupToFlight(
  flight: FlightResult,
  ctx: MarkupContext,
  tripType: "ONEWAY" | "ROUNDTRIP",
  exchangeRate?: number | null,
): Promise<FlightResult> {
  const { sellPrice } = await computeForFlight(flight, ctx, tripType);
  return applyPriceToFlight(flight, sellPrice, exchangeRate);
}

export async function applyMarkupToFlights(
  flights: FlightResult[],
  ctx: MarkupContext,
  tripType: "ONEWAY" | "ROUNDTRIP",
  exchangeRate?: number | null,
): Promise<FlightResult[]> {
  return Promise.all(flights.map((flight) => applyMarkupToFlight(flight, ctx, tripType, exchangeRate)));
}

export async function applyMarkupToPair(
  pair: RoundtripPairOption,
  ctx: MarkupContext,
  exchangeRate?: number | null,
): Promise<RoundtripPairOption> {
  const [outbound, inbound] = await Promise.all([
    applyMarkupToFlight(pair.outbound, ctx, "ROUNDTRIP", exchangeRate),
    applyMarkupToFlight(pair.inbound, ctx, "ROUNDTRIP", exchangeRate),
  ]);
  const newTotalAmount =
    Number(outbound.fareBreakdown?.totalAmount ?? outbound.price?.amount ?? 0) +
    Number(inbound.fareBreakdown?.totalAmount ?? inbound.price?.amount ?? 0);
  const newTotalUSD = typeof exchangeRate === "number" && exchangeRate > 0
    ? Math.round(newTotalAmount / exchangeRate)
    : pair.totalUSD;
  return { ...pair, outbound, inbound, totalAmount: newTotalAmount, totalUSD: newTotalUSD };
}

export async function applyMarkupToPairs(
  pairs: RoundtripPairOption[],
  ctx: MarkupContext,
  exchangeRate?: number | null,
): Promise<RoundtripPairOption[]> {
  return Promise.all(pairs.map((pair) => applyMarkupToPair(pair, ctx, exchangeRate)));
}

/**
 * Tính markup chỉ dựa trên rules airline-agnostic (airline = null) — dùng cho lowest-fare.
 * Vì lowest-fare không biết hãng cụ thể, chỉ áp được rule chung domestic/international/global.
 */
export async function computeAirlineAgnosticMarkup(
  netAmount: number,
  from: string,
  to: string,
  ctx: MarkupContext,
): Promise<number> {
  if (!Number.isFinite(netAmount) || netAmount <= 0) return netAmount;
  const dom = classifyDomestic(from, to, ctx.airports);
  const airlineAgnosticRules = ctx.rules.filter((rule) => !rule.airline);
  if (airlineAgnosticRules.length === 0) return netAmount;

  const result = await computeMarkup(
    {
      airline: "",
      channel: ctx.channel,
      fareClass: null,
      paxType: ctx.paxType,
      domesticInternational: dom,
      tripType: "ONEWAY",
      route: `${from}-${to}`,
      netPrice: new Prisma.Decimal(netAmount),
    },
    airlineAgnosticRules,
  );
  return Number(result.sellPrice.toString());
}
