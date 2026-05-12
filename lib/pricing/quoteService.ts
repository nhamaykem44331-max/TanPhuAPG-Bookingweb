import prismaClient from "@prisma/client";
import type { MarkupRule } from "@prisma/client";

import type { HoldInput } from "@/lib/bookings/schemas";
import { priceNamThanhFlight, NamThanhApiError } from "@/lib/namthanh";
import type { FlightResult } from "@/lib/types";
import { computeMarkup } from "@/lib/pricing/markupEngine";
import { QuoteExpiredError, QuoteUnavailableError } from "@/lib/pricing/errors";
import { prisma } from "@/lib/db";

const { Prisma } = prismaClient;
const DEFAULT_BACKEND_URL = "http://localhost:3100";

type QuoteChannel = "web" | "admin";

export interface QuoteLegMarkupRule {
  id: string;
  name: string;
  markupType: "FIXED" | "PERCENT";
  markupValue: string;
  serviceFee: string;
}

export interface QuoteLegBreakdown {
  legKey: "outbound" | "inbound";
  airline: string;
  route: string;
  fareClass: string | null;
  cabin: string | null;
  paxType: string | null;
  domesticInternational: string | null;
  netPrice: prismaClient.Prisma.Decimal;
  markupAmount: prismaClient.Prisma.Decimal;
  serviceFeeAmount: prismaClient.Prisma.Decimal;
  sellPrice: prismaClient.Prisma.Decimal;
  currency: "VND";
  departureAt: string | null;
  arrivalAt: string | null;
  rawQuote: unknown;
  markupRule: QuoteLegMarkupRule | null;
}

export interface QuoteServiceResult {
  currency: "VND";
  expiresAt: string | null;
  legs: QuoteLegBreakdown[];
  totalNetPrice: prismaClient.Prisma.Decimal;
  totalMarkupAmount: prismaClient.Prisma.Decimal;
  totalServiceFeeAmount: prismaClient.Prisma.Decimal;
  totalSellPrice: prismaClient.Prisma.Decimal;
}

interface AirportRecord {
  code: string;
  domestic: boolean;
}

let airportIndexPromise: Promise<Map<string, boolean> | null> | null = null;

function backendUrl(): string {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const key = process.env.NAMTHANH_BACKEND_API_KEY;

  if (key) {
    headers["X-API-Key"] = key;
  }

  return headers;
}

function toDecimal(value: string | number | prismaClient.Prisma.Decimal): prismaClient.Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text.toUpperCase() : null;
}

function guessFareClass(flight: FlightResult, rawQuote: unknown): string | null {
  const raw = rawQuote && typeof rawQuote === "object" ? (rawQuote as Record<string, unknown>) : {};
  const summary = raw.summary && typeof raw.summary === "object" ? (raw.summary as Record<string, unknown>) : {};

  return normalizeText(
    String(
      summary.class ||
        summary.fareBasis ||
        flight.namthanh?.class ||
        flight.namthanh?.fareBasis ||
        flight.namthanh?.cabinClass ||
        "",
    ),
  );
}

function guessCabin(flight: FlightResult, rawQuote: unknown): string | null {
  const raw = rawQuote && typeof rawQuote === "object" ? (rawQuote as Record<string, unknown>) : {};
  const summary = raw.summary && typeof raw.summary === "object" ? (raw.summary as Record<string, unknown>) : {};

  return normalizeText(String(summary.cabinClass || flight.namthanh?.cabinClass || ""));
}

function extractNetPrice(rawQuote: unknown, fallbackFlight: FlightResult): prismaClient.Prisma.Decimal {
  const raw = rawQuote && typeof rawQuote === "object" ? (rawQuote as Record<string, unknown>) : {};
  const flight = raw.flight && typeof raw.flight === "object" ? (raw.flight as Record<string, unknown>) : {};
  const fareBreakdown =
    raw.fareBreakdown && typeof raw.fareBreakdown === "object"
      ? (raw.fareBreakdown as Record<string, unknown>)
      : flight.fareBreakdown && typeof flight.fareBreakdown === "object"
        ? (flight.fareBreakdown as Record<string, unknown>)
        : null;
  const summary = raw.summary && typeof raw.summary === "object" ? (raw.summary as Record<string, unknown>) : {};
  const candidate =
    fareBreakdown?.totalAmount ??
    (summary.total as number | string | undefined) ??
    fallbackFlight.fareBreakdown?.totalAmount ??
    fallbackFlight.price.amount;
  const scalarCandidate =
    typeof candidate === "number" || typeof candidate === "string" || candidate instanceof Prisma.Decimal
      ? candidate
      : 0;

  return toDecimal(scalarCandidate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

function routeOfFlight(flight: FlightResult): string {
  return `${flight.departure.airport}-${flight.arrival.airport}`.toUpperCase();
}

function flightDate(flight: FlightResult): string {
  const value = String(flight.departure?.time || "");
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);

  if (direct) {
    return direct[1];
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function flightTime(flight: FlightResult): string {
  const value = String(flight.departure?.time || "");
  const direct = value.match(/T(\d{2}:\d{2})|(?:^|\s)(\d{1,2}:\d{2})/);

  if (direct) {
    return (direct[1] || direct[2] || "").padStart(5, "0");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function passengerCounts(passengers: HoldInput["passengers"]) {
  return passengers.reduce(
    (counts, passenger) => {
      if (passenger.type === "ADT") counts.adults += 1;
      if (passenger.type === "CHD") counts.children += 1;
      if (passenger.type === "INF") counts.infants += 1;
      return counts;
    },
    { adults: 0, children: 0, infants: 0 },
  );
}

function routeQuotePayloadFromFlight(flight: FlightResult, passengers: HoldInput["passengers"]) {
  const from = String(flight.departure?.airport || "").toUpperCase();
  const to = String(flight.arrival?.airport || "").toUpperCase();
  const date = flightDate(flight);
  const counts = passengerCounts(passengers);

  if (!from || !to || !date) {
    return null;
  }

  return {
    from,
    to,
    date,
    airline: flight.airlineCode || undefined,
    flightNumber: flight.flightNumber || undefined,
    time: flightTime(flight) || undefined,
    cabin: flight.namthanh?.cabinClass || undefined,
    fareId: flight.fareId || flight.namthanh?.fareId || undefined,
    adults: counts.adults,
    children: counts.children,
    infants: counts.infants,
  };
}

function resolveMarkupPaxType(passengers: HoldInput["passengers"]): string | null {
  const counts = new Map<string, number>();

  for (const passenger of passengers) {
    counts.set(passenger.type, (counts.get(passenger.type) ?? 0) + 1);
  }

  const activeTypes = [...counts.entries()].filter((entry) => entry[1] > 0);

  if (activeTypes.length !== 1) {
    return null;
  }

  return activeTypes[0]?.[0] ?? null;
}

async function loadAirportIndex(): Promise<Map<string, boolean> | null> {
  if (!airportIndexPromise) {
    airportIndexPromise = (async () => {
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

        if (!response.ok || !Array.isArray(payload?.airports)) {
          return null;
        }

        return new Map(payload.airports.map((airport) => [airport.code.toUpperCase(), !!airport.domestic]));
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();
  }

  return airportIndexPromise;
}

async function classifyDomesticInternational(route: string): Promise<string | null> {
  const [routeFrom, routeTo] = route.split("-");

  if (!routeFrom || !routeTo) {
    return null;
  }

  const airportIndex = await loadAirportIndex();

  if (!airportIndex) {
    return null;
  }

  const fromDomestic = airportIndex.get(routeFrom.toUpperCase());
  const toDomestic = airportIndex.get(routeTo.toUpperCase());

  if (fromDomestic === true && toDomestic === true) {
    return "DOMESTIC";
  }

  if (fromDomestic !== undefined && toDomestic !== undefined) {
    return "INTERNATIONAL";
  }

  return null;
}

function isQuoteCacheMissError(error: unknown): boolean {
  if (!(error instanceof NamThanhApiError)) {
    return false;
  }

  const text = `${error.message} ${JSON.stringify(error.details ?? {})}`.toLowerCase();

  return (
    text.includes("search not found or expired") ||
    text.includes("flight not found in search cache") ||
    text.includes("fare not found in search cache")
  );
}

function mapQuoteError(error: unknown): never {
  if (!(error instanceof NamThanhApiError)) {
    throw error;
  }

  const text = `${error.message} ${JSON.stringify(error.details ?? {})}`.toLowerCase();

  if (
    text.includes("search not found or expired") ||
    text.includes("flight not found in search cache") ||
    text.includes("fare not found in search cache") ||
    text.includes("expired")
  ) {
    throw new QuoteExpiredError();
  }

  if (text.includes("no matching flight found")) {
    throw new QuoteExpiredError("FLIGHT_NOT_AVAILABLE");
  }

  if (
    text.includes("sold out") ||
    text.includes("no seat") ||
    text.includes("khong con cho") ||
    text.includes("không còn chỗ")
  ) {
    throw new QuoteUnavailableError();
  }

  throw error;
}

async function priceLegWithCacheFallback(
  flight: FlightResult,
  passengers: HoldInput["passengers"],
): Promise<Awaited<ReturnType<typeof priceNamThanhFlight>>> {
  const flightId = flight.id || flight.namthanh?.flightId;

  if (flight.searchId && flightId) {
    try {
      return await priceNamThanhFlight({
        searchId: flight.searchId,
        flightId,
        fareId: flight.fareId || flight.namthanh?.fareId,
      });
    } catch (error) {
      if (!isQuoteCacheMissError(error)) {
        mapQuoteError(error);
      }
    }
  }

  const routePayload = routeQuotePayloadFromFlight(flight, passengers);

  if (!routePayload) {
    throw new QuoteExpiredError();
  }

  try {
    return await priceNamThanhFlight(routePayload);
  } catch (error) {
    mapQuoteError(error);
  }
}

async function loadActiveRules(): Promise<MarkupRule[]> {
  return prisma.markupRule.findMany({
    where: { active: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

async function quoteLeg(input: {
  legKey: "outbound" | "inbound";
  flight: FlightResult;
  passengers: HoldInput["passengers"];
  tripType: HoldInput["tripType"];
  channel: QuoteChannel;
  rules: MarkupRule[];
}): Promise<QuoteLegBreakdown> {
  const rawQuote = await priceLegWithCacheFallback(input.flight, input.passengers);

  const quotedFlight = rawQuote.flight;
  const route = routeOfFlight(quotedFlight);
  const fareClass = guessFareClass(quotedFlight, rawQuote);
  const cabin = guessCabin(quotedFlight, rawQuote);
  const paxType = resolveMarkupPaxType(input.passengers);
  const domesticInternational = await classifyDomesticInternational(route);
  const netPrice = extractNetPrice(rawQuote, quotedFlight);
  const markup = await computeMarkup(
    {
      airline: quotedFlight.airlineCode,
      channel: input.channel,
      fareClass,
      paxType,
      domesticInternational,
      tripType: input.tripType,
      route,
      netPrice,
    },
    input.rules,
  );
  const matchedRule = markup.ruleId ? input.rules.find((rule) => rule.id === markup.ruleId) ?? null : null;
  const serviceFeeAmount = toDecimal(matchedRule?.serviceFee ?? 0);

  return {
    legKey: input.legKey,
    airline: quotedFlight.airlineCode,
    route,
    fareClass,
    cabin,
    paxType,
    domesticInternational,
    netPrice,
    markupAmount: markup.markupAmount,
    serviceFeeAmount,
    sellPrice: markup.sellPrice.plus(serviceFeeAmount),
    currency: "VND",
    departureAt: quotedFlight.departure.time || null,
    arrivalAt: quotedFlight.arrival.time || null,
    rawQuote,
    markupRule:
      matchedRule && markup.ruleId
        ? {
            id: matchedRule.id,
            name: markup.ruleName ?? matchedRule.scope,
            markupType: matchedRule.markupType,
            markupValue: matchedRule.markupValue.toString(),
            serviceFee: String(matchedRule.serviceFee),
          }
        : null,
  };
}

function latestExpiry(legs: QuoteLegBreakdown[]): string | null {
  const values = legs
    .map((leg) => leg.departureAt)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return new Date(Math.max(...values)).toISOString();
}

export async function quoteBooking(
  input: HoldInput,
  channel: QuoteChannel,
): Promise<QuoteServiceResult> {
  const rules = await loadActiveRules();
  const legs: QuoteLegBreakdown[] = [];

  legs.push(
    await quoteLeg({
      legKey: "outbound",
      flight: input.outbound as FlightResult,
      passengers: input.passengers,
      tripType: input.tripType,
      channel,
      rules,
    }),
  );

  if (input.tripType === "ROUNDTRIP" && input.inbound) {
    legs.push(
      await quoteLeg({
        legKey: "inbound",
        flight: input.inbound as FlightResult,
        passengers: input.passengers,
        tripType: input.tripType,
        channel,
        rules,
      }),
    );
  }

  const totalNetPrice = legs.reduce((sum, leg) => sum.plus(leg.netPrice), toDecimal(0));
  const totalMarkupAmount = legs.reduce((sum, leg) => sum.plus(leg.markupAmount), toDecimal(0));
  const totalServiceFeeAmount = legs.reduce((sum, leg) => sum.plus(leg.serviceFeeAmount), toDecimal(0));
  const totalSellPrice = legs.reduce((sum, leg) => sum.plus(leg.sellPrice), toDecimal(0));

  return {
    currency: "VND",
    expiresAt: latestExpiry(legs),
    legs,
    totalNetPrice,
    totalMarkupAmount,
    totalServiceFeeAmount,
    totalSellPrice,
  };
}
