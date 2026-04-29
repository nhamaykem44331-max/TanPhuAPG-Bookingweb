import prismaClient from "@prisma/client";
import type { Prisma as PrismaNamespace } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getAuditRequestMeta } from "@/lib/audit";
import type { HoldInput, HoldPassengerInput } from "@/lib/bookings/schemas";
import { generateUniqueOrderCode } from "@/lib/bookings/orderManagement";
import { holdInputSchema } from "@/lib/bookings/schemas";
import { holdNamThanhBooking, NamThanhApiError } from "@/lib/namthanh";
import { notify } from "@/lib/notifications";
import { createPaymentIntentForBooking, PaymentIntentError } from "@/lib/payments/paymentIntentService";
import { QuoteExpiredError, QuoteUnavailableError } from "@/lib/pricing/errors";
import { quoteBooking, type QuoteServiceResult } from "@/lib/pricing/quoteService";
import type { FlightResult, HoldBookingPassenger, HoldBookingResponse } from "@/lib/types";

const { BookingStatus, Prisma } = prismaClient;

export const runtime = "nodejs";
export const maxDuration = 300;

type LooseRecord = Record<string, unknown>;
type QuoteChannel = "web" | "admin";

interface NormalizedHoldBody {
  input: unknown;
  outboundFlight: FlightResult;
  inboundFlight?: FlightResult;
}

function recordOf(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    fieldErrors[key] = [...(fieldErrors[key] || []), issue.message];
  }

  return fieldErrors;
}

function compactText(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function cleanKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function stableHash(value: string): string {
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }

  return (hash >>> 0).toString(36).toUpperCase();
}

function normalizeIdempotencyKey(value: unknown): string | undefined {
  const cleaned = cleanKey(String(value || ""));

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.length <= 120) {
    return cleaned;
  }

  return `${cleaned.slice(0, 96)}-${stableHash(cleaned)}`.slice(0, 120);
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = compactText(fullName).split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(" "),
  };
}

function normalizeDate(value: unknown): string | undefined {
  const text = String(value || "").trim();

  if (!text) {
    return undefined;
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (ymd) {
    return text;
  }

  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);

  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return undefined;
}

function normalizePhone(value: unknown): string {
  const digits = String(value || "").replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

function normalizePassengers(value: unknown): HoldPassengerInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const passenger = recordOf(item);
      const fullName = compactText(passenger.fullName || passenger.name || `${passenger.lastName || ""} ${passenger.firstName || ""}`);
      const split = splitFullName(fullName);
      const rawType = compactText(passenger.type || "ADT");
      const type: HoldPassengerInput["type"] = rawType === "CHD" || rawType === "INF" ? rawType : "ADT";
      const gender: HoldPassengerInput["gender"] =
        passenger.gender === "F" ? "F" : passenger.gender === "M" ? "M" : undefined;

      return {
        type,
        firstName: compactText(passenger.firstName) || split.firstName,
        lastName: compactText(passenger.lastName) || split.lastName,
        fullName,
        dob: normalizeDate(passenger.dob || passenger.dateOfBirth || passenger.birthday),
        gender,
        loyaltyAirline: compactText(passenger.loyaltyAirline) || undefined,
        loyaltyNumber: compactText(passenger.loyaltyNumber) || undefined,
        passport: passenger.passport && typeof passenger.passport === "object"
          ? {
              number: compactText(recordOf(passenger.passport).number) || undefined,
              nationality: compactText(recordOf(passenger.passport).nationality) || undefined,
              issuingCountry: compactText(recordOf(passenger.passport).issuingCountry) || undefined,
              issueDate: normalizeDate(recordOf(passenger.passport).issueDate),
              expiryDate: normalizeDate(recordOf(passenger.passport).expiryDate),
            }
          : undefined,
        listLuggage: Array.isArray(passenger.listLuggage) ? (passenger.listLuggage as HoldPassengerInput["listLuggage"]) : undefined,
        ancillaryServices: Array.isArray(passenger.ancillaryServices)
          ? (passenger.ancillaryServices as HoldPassengerInput["ancillaryServices"])
          : undefined,
      };
    })
    .filter((passenger) => passenger.firstName && passenger.lastName);
}

function countPassengers(passengers: HoldPassengerInput[]): { adt: number; chd: number; inf: number } {
  return passengers.reduce(
    (counts, passenger) => {
      if (passenger.type === "CHD") {
        counts.chd += 1;
      } else if (passenger.type === "INF") {
        counts.inf += 1;
      } else {
        counts.adt += 1;
      }

      return counts;
    },
    { adt: 0, chd: 0, inf: 0 },
  );
}

function deriveDisplayedNetPrice(outbound: FlightResult, inbound?: FlightResult): number {
  const flights = [outbound, ...(inbound ? [inbound] : [])];

  return flights.reduce((total, flight) => {
    const amount = flight.fareBreakdown?.totalAmount ?? flight.price?.amount ?? 0;
    return total + Number(amount || 0);
  }, 0);
}

function deriveSearch(outbound: FlightResult, inbound?: FlightResult): HoldInput["search"] {
  const outboundDate = String(outbound.departure.time || "").slice(0, 10);
  const inboundDate = inbound ? String(inbound.departure.time || "").slice(0, 10) : undefined;

  if (!outbound.departure.airport || !outbound.arrival.airport || !outboundDate) {
    return undefined;
  }

  return {
    from: outbound.departure.airport,
    to: outbound.arrival.airport,
    date: outboundDate,
    returnDate: inboundDate,
  };
}

function normalizeTripType(value: unknown, inbound?: FlightResult): HoldInput["tripType"] {
  const text = String(value || "").trim().toUpperCase();

  if (text === "ROUNDTRIP" || text === "ROUND_TRIP" || text === "ROUND-TRIP") {
    return "ROUNDTRIP";
  }

  if (text === "ONEWAY" || text === "ONE_WAY" || text === "ONE-WAY") {
    return "ONEWAY";
  }

  return inbound ? "ROUNDTRIP" : "ONEWAY";
}

function normalizeHoldBody(rawBody: unknown, request: NextRequest): NormalizedHoldBody {
  const body = recordOf(rawBody);
  const outboundFlight = (body.outbound || body.flight) as FlightResult;
  const inboundFlight = body.inbound ? (body.inbound as FlightResult) : undefined;

  if (!outboundFlight || !outboundFlight.id) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["outbound"],
        message: "Thiếu chuyến bay outbound.",
      },
    ]);
  }

  const passengers = normalizePassengers(body.passengers);
  const leadPassenger = passengers[0];
  const fallbackContactName = leadPassenger?.fullName || `${leadPassenger?.lastName || ""} ${leadPassenger?.firstName || ""}`.trim();
  const search = recordOf(body.search);
  const input = {
    tripType: normalizeTripType(body.tripType, inboundFlight),
    displayedNetPrice:
      body.displayedNetPrice ??
      deriveDisplayedNetPrice(outboundFlight, inboundFlight),
    passengers,
    contact: {
      fullName: String(recordOf(body.contact).fullName || fallbackContactName || "").trim(),
      phone: normalizePhone(recordOf(body.contact).phone),
      email: String(recordOf(body.contact).email || "").trim(),
    },
    outbound: outboundFlight,
    inbound: inboundFlight,
    cabin: String(body.cabin || "").trim() || undefined,
    search:
      search.from && search.to && search.date
        ? {
            from: String(search.from).toUpperCase(),
            to: String(search.to).toUpperCase(),
            date: String(search.date),
            returnDate: search.returnDate ? String(search.returnDate) : undefined,
          }
        : deriveSearch(outboundFlight, inboundFlight),
    dryRun: body.dryRun === true,
    idempotencyKey: normalizeIdempotencyKey(body.idempotencyKey || request.headers.get("idempotency-key")),
  };

  return {
    input,
    outboundFlight,
    inboundFlight,
  };
}

function parseDateTime(value: unknown): Date | null {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const direct = new Date(text);

  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+|T)?(\d{2}):(\d{2})/);

  if (dmy) {
    return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}:${dmy[5]}:00+07:00`);
  }

  return null;
}

function routeSummary(input: HoldInput): string {
  if (input.tripType === "ROUNDTRIP" && input.inbound) {
    return `${input.outbound.departure.airport}-${input.outbound.arrival.airport} / ${input.inbound.departure.airport}-${input.inbound.arrival.airport}`;
  }

  return `${input.outbound.departure.airport}-${input.outbound.arrival.airport}`;
}

function toLegacyPassengers(passengers: HoldPassengerInput[]): HoldBookingPassenger[] {
  return passengers.map((passenger, index) => {
    const fullName = compactText(passenger.fullName || `${passenger.lastName} ${passenger.firstName}`);

    return {
      id: `${passenger.type}${index + 1}`,
      type: passenger.type,
      title: passenger.gender === "F" ? (passenger.type === "ADT" ? "MS" : "MISS") : passenger.type === "ADT" ? "MR" : "MSTR",
      firstName: compactText(passenger.firstName),
      lastName: compactText(passenger.lastName),
      fullName,
      name: fullName,
      dateOfBirth: passenger.dob,
      birthday: passenger.dob,
      loyaltyAirline: passenger.loyaltyAirline,
      loyaltyNumber: passenger.loyaltyNumber,
      passport: passenger.passport,
      listLuggage: passenger.listLuggage as HoldBookingPassenger["listLuggage"],
      ancillaryServices: passenger.ancillaryServices as HoldBookingPassenger["ancillaryServices"],
    };
  });
}

function serializeQuote(quote: QuoteServiceResult) {
  return {
    currency: quote.currency,
    expiresAt: quote.expiresAt,
    totalNetPrice: quote.totalNetPrice.toFixed(0),
    totalMarkupAmount: quote.totalMarkupAmount.toFixed(0),
    totalServiceFeeAmount: quote.totalServiceFeeAmount.toFixed(0),
    totalSellPrice: quote.totalSellPrice.toFixed(0),
    legs: quote.legs.map((leg) => ({
      legKey: leg.legKey,
      airline: leg.airline,
      route: leg.route,
      fareClass: leg.fareClass,
      cabin: leg.cabin,
      paxType: leg.paxType,
      domesticInternational: leg.domesticInternational,
      netPrice: leg.netPrice.toFixed(0),
      markupAmount: leg.markupAmount.toFixed(0),
      serviceFeeAmount: leg.serviceFeeAmount.toFixed(0),
      sellPrice: leg.sellPrice.toFixed(0),
      currency: leg.currency,
      departureAt: leg.departureAt,
      arrivalAt: leg.arrivalAt,
      markupRule: leg.markupRule,
    })),
  };
}

function toJsonValue(value: unknown): PrismaNamespace.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as PrismaNamespace.InputJsonValue;
}

function serializePnrPricing(quote: QuoteServiceResult, pnrs: NonNullable<HoldBookingResponse["pnrs"]>) {
  if (pnrs.length === 0) {
    return [];
  }

  if (pnrs.length === 1 && quote.legs.length > 1) {
    return [{
      pnr: pnrs[0].pnr || "PNR-1",
      totalAmount: Number(quote.totalSellPrice.toFixed(0)),
      currency: quote.currency,
      timelimit: pnrs[0].timelimit,
    }];
  }

  const usedLegIndexes = new Set<number>();

  return pnrs.map((pnr, index) => {
    const routeCode =
      pnr.from && pnr.to
        ? `${String(pnr.from).trim().toUpperCase()}-${String(pnr.to).trim().toUpperCase()}`
        : "";
    const airlineCode = compactText(pnr.airline || "");
    const candidateIndex =
      quote.legs.findIndex(
        (leg, legIndex) =>
          !usedLegIndexes.has(legIndex) &&
          (routeCode ? compactText(leg.route) === compactText(routeCode) : true) &&
          (airlineCode ? compactText(leg.airline) === airlineCode : true),
      ) >= 0
        ? quote.legs.findIndex(
            (leg, legIndex) =>
              !usedLegIndexes.has(legIndex) &&
              (routeCode ? compactText(leg.route) === compactText(routeCode) : true) &&
              (airlineCode ? compactText(leg.airline) === airlineCode : true),
          )
        : quote.legs.findIndex((_, legIndex) => !usedLegIndexes.has(legIndex));
    const matchedLeg = candidateIndex >= 0 ? quote.legs[candidateIndex] : null;

    if (candidateIndex >= 0) {
      usedLegIndexes.add(candidateIndex);
    }

    return {
      pnr: pnr.pnr || `PNR-${index + 1}`,
      totalAmount: matchedLeg ? Number(matchedLeg.sellPrice.toFixed(0)) : Number(quote.totalSellPrice.toFixed(0)),
      currency: quote.currency,
      timelimit: pnr.timelimit,
    };
  });
}

function comparePrices(displayedNetPrice: number, freshNetPrice: prismaClient.Prisma.Decimal) {
  const displayed = new Prisma.Decimal(displayedNetPrice);
  const fresh = new Prisma.Decimal(freshNetPrice);

  if (displayed.lessThanOrEqualTo(0)) {
    return null;
  }

  const delta = fresh.minus(displayed);
  const percent = delta.mul(100).div(displayed).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP);

  return {
    displayed,
    fresh,
    delta,
    percent,
    shouldWarn: percent.abs().greaterThan(5),
  };
}

function toPriceDeltaPayload(delta: ReturnType<typeof comparePrices>) {
  if (!delta || !delta.shouldWarn) {
    return undefined;
  }

  const percentText = delta.percent.toFixed(1);

  return {
    before: delta.displayed.toFixed(0),
    after: delta.fresh.toFixed(0),
    percent: delta.percent.greaterThanOrEqualTo(0) ? `+${percentText}` : percentText,
    reason: "AIRLINE_PRICE_CHANGE" as const,
  };
}

function firstMarkupRule(quote: QuoteServiceResult): { id: string; name: string } | undefined {
  const rules = quote.legs
    .map((leg) => leg.markupRule)
    .filter((rule): rule is NonNullable<typeof rule> => !!rule);

  if (rules.length === 0) {
    return undefined;
  }

  const [first] = rules;

  if (rules.every((rule) => rule.id === first.id)) {
    return {
      id: first.id,
      name: first.name,
    };
  }

  return undefined;
}

function deriveHoldExpiresAt(quote: QuoteServiceResult, holdResult: HoldBookingResponse): string | null {
  const pnrDates = (holdResult.pnrs || [])
    .map((pnr) => parseDateTime(pnr.timelimit))
    .sort((left, right) => (left?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .filter((value): value is Date => !!value);

  if (pnrDates.length > 0) {
    return pnrDates[0].toISOString();
  }

  return quote.expiresAt;
}

type ExistingBookingRecord = PrismaNamespace.BookingGetPayload<{
  include: {
    appliedMarkupRule: {
      select: {
        id: true;
        scope: true;
      };
    };
    pnrs: true;
  };
}>;

function responseFromExistingBooking(booking: ExistingBookingRecord) {
  const firstRule = booking.appliedMarkupRule
    ? {
        id: booking.appliedMarkupRule.id,
        name: booking.appliedMarkupRule.scope,
      }
    : undefined;

    return {
      success: true,
      bookingId: booking.id,
      orderCode: booking.orderCode,
      pnr: booking.pnr ?? undefined,
      netPrice: String(booking.netAmount),
    markupAmount: String(booking.markupAmount),
    sellPrice: String(booking.saleAmount),
    currency: booking.currency,
    holdExpiresAt: booking.ttlExpiresAt?.toISOString() ?? null,
    markupRuleApplied: firstRule,
    dryRun: false,
    totalAmount: booking.saleAmount,
    pricing: {
      verified: true,
      source: "booking-cache",
      totalAmount: booking.saleAmount,
      currency: booking.currency,
      byPnr: [],
      unresolvedPnrs: [],
      syncedAt: booking.updatedAt.toISOString(),
    },
    pnrs: booking.pnrs.map((pnr) => ({
      airline: pnr.airline ?? undefined,
      pnr: pnr.pnr,
      status: pnr.status ?? undefined,
      timelimit: pnr.timelimit?.toISOString(),
    })),
  };
}

type UpstreamClassification = {
  errorCode: "BACKEND_TIMEOUT" | "SESSION_EXPIRED" | "BACKEND_DOWN"
            | "BACKEND_AUTH" | "BACKEND_COLD_START" | "UPSTREAM_UNAVAILABLE";
  httpStatus: number;
  userMessage: string;
  retryable: boolean;
  retryDelayMs?: number;
};

function classifyUpstreamError(error: NamThanhApiError): UpstreamClassification {
  const text = `${error.message} ${JSON.stringify(error.details ?? {})}`.toLowerCase();

  if (error.status === 504 || text.includes("timeout") || text.includes("abort")) {
    return {
      errorCode: "BACKEND_TIMEOUT",
      httpStatus: 504,
      userMessage: "Hệ thống Nam Thanh phản hồi chậm. Vui lòng thử lại sau vài giây.",
      retryable: true,
      retryDelayMs: 3000,
    };
  }

  if (text.includes("session time out") || text.includes("session expired") || text.includes("login required")) {
    return {
      errorCode: "SESSION_EXPIRED",
      httpStatus: 503,
      userMessage: "Phiên Nam Thanh đã hết hạn. Hệ thống sẽ thử đăng nhập lại, vui lòng thử lại sau ít giây.",
      retryable: true,
      retryDelayMs: 2000,
    };
  }

  if (error.status === 401 || error.status === 403 || text.includes("unauthorized") || text.includes("api key")) {
    return {
      errorCode: "BACKEND_AUTH",
      httpStatus: 502,
      userMessage: "Lỗi xác thực giữa frontend và backend. Vui lòng liên hệ CSKH để admin xử lý.",
      retryable: false,
    };
  }

  if (
    error.status === 502 ||
    error.status === 503 ||
    text.includes("econnrefused") ||
    text.includes("render.com") ||
    text.includes("unavailable")
  ) {
    return {
      errorCode: "BACKEND_DOWN",
      httpStatus: 503,
      userMessage: "Backend Nam Thanh đang khởi động hoặc tạm không phản hồi. Vui lòng thử lại sau vài giây.",
      retryable: true,
      retryDelayMs: 5000,
    };
  }

  return {
    errorCode: "UPSTREAM_UNAVAILABLE",
    httpStatus: 502,
    userMessage: "Hệ thống Nam Thanh tạm thời không xử lý được yêu cầu. Vui lòng liên hệ CSKH nếu lỗi tiếp diễn.",
    retryable: false,
  };
}

function quoteErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof QuoteExpiredError) {
    return NextResponse.json({ error: "QUOTE_EXPIRED" }, { status: 409 });
  }

  if (error instanceof QuoteUnavailableError) {
    return NextResponse.json({ error: "SOLD_OUT" }, { status: 409 });
  }

  if (error instanceof NamThanhApiError) {
    const text = `${error.message} ${JSON.stringify(error.details ?? {})}`.toLowerCase();
    const details = recordOf(error.details);

    // Trường hợp PNR mồ côi (split roundtrip: outbound thành công, inbound fail)
    // → Phải forward orphanPnrs về frontend để user thấy mã đặt chỗ đã tạo
    // và admin có thể follow-up huỷ thủ công nếu auto-cancel chưa chạy
    if (details.splitRoundtrip && details.completedLeg === "outbound") {
      const orphanPnrs = Array.isArray(details.orphanPnrs) ? details.orphanPnrs : [];
      const cancelStatus = String(details.orphanCancelStatus || "NEEDS_MANUAL_CANCEL");
      return NextResponse.json(
        {
          error: "PARTIAL_HOLD",
          detail: error.message,
          splitRoundtrip: true,
          orphanPnrs,
          orphanCancelStatus: cancelStatus,
          orphanCancelAttempts: details.orphanCancelAttempts || [],
        },
        { status: 502 },
      );
    }

    if (text.includes("expired")) {
      return NextResponse.json({ error: "QUOTE_EXPIRED" }, { status: 409 });
    }

    if (text.includes("sold out") || text.includes("không còn chỗ") || text.includes("khong con cho")) {
      return NextResponse.json({ error: "SOLD_OUT" }, { status: 409 });
    }

    const classification = classifyUpstreamError(error);
    return NextResponse.json(
      {
        error: classification.errorCode,
        detail: error.message,
        userMessage: classification.userMessage,
        retryable: classification.retryable,
        retryDelayMs: classification.retryDelayMs,
      },
      { status: classification.httpStatus },
    );
  }

  return null;
}

function buildHoldPnrRecords(
  input: HoldInput,
  quote: QuoteServiceResult,
  holdResult: HoldBookingResponse,
  bookingId: string,
  fallbackHoldExpiresAt: string | null,
) {
  const rawPnrs = (holdResult.pnrs || []).length > 0
    ? holdResult.pnrs || []
    : [
        {
          airline: input.outbound.airlineCode,
          pnr: `PENDING-${bookingId}`,
          status: "PENDING",
          timelimit: fallbackHoldExpiresAt ?? undefined,
        },
      ];
  const routeFallbacks = [
    {
      routeSummary: `${input.outbound.departure.airport}-${input.outbound.arrival.airport}`,
      departAt: parseDateTime(input.outbound.departure.time),
      airline: input.outbound.airlineCode || null,
    },
    ...(input.inbound
      ? [
          {
            routeSummary: `${input.inbound.departure.airport}-${input.inbound.arrival.airport}`,
            departAt: parseDateTime(input.inbound.departure.time),
            airline: input.inbound.airlineCode || null,
          },
        ]
      : []),
  ];
  const usedLegIndexes = new Set<number>();

  return rawPnrs.map((pnr, index) => {
    const routeCode =
      pnr.from && pnr.to
        ? `${String(pnr.from).trim().toUpperCase()}-${String(pnr.to).trim().toUpperCase()}`
        : "";
    const airlineCode = compactText(pnr.airline || "");
    const candidateIndex =
      quote.legs.findIndex(
        (leg, legIndex) =>
          !usedLegIndexes.has(legIndex) &&
          (routeCode ? compactText(leg.route) === compactText(routeCode) : true) &&
          (airlineCode ? compactText(leg.airline) === airlineCode : true),
      ) >= 0
        ? quote.legs.findIndex(
            (leg, legIndex) =>
              !usedLegIndexes.has(legIndex) &&
              (routeCode ? compactText(leg.route) === compactText(routeCode) : true) &&
              (airlineCode ? compactText(leg.airline) === airlineCode : true),
          )
        : quote.legs.findIndex((_, legIndex) => !usedLegIndexes.has(legIndex));
    const matchedLeg = candidateIndex >= 0 ? quote.legs[candidateIndex] : null;
    const fallbackRoute =
      rawPnrs.length === 1
        ? {
            routeSummary: routeSummary(input),
            departAt: parseDateTime(input.outbound.departure.time),
            airline: input.outbound.airlineCode || null,
          }
        : routeFallbacks[index] ?? routeFallbacks[0];

    if (candidateIndex >= 0) {
      usedLegIndexes.add(candidateIndex);
    }

    return {
      bookingId,
      airline: pnr.airline || matchedLeg?.airline || fallbackRoute?.airline || null,
      pnr: pnr.pnr || `PENDING-${bookingId}`,
      status: pnr.status || "HELD",
      routeSummary: routeCode || matchedLeg?.route || fallbackRoute?.routeSummary || null,
      departAt: matchedLeg?.departureAt ? new Date(matchedLeg.departureAt) : fallbackRoute?.departAt ?? null,
      timelimit: parseDateTime(pnr.timelimit),
      rawJson: pnr,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const normalized = normalizeHoldBody(rawBody, request);
    const parsedInput = holdInputSchema.safeParse(normalized.input);

    if (!parsedInput.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fieldErrors: zodFieldErrors(parsedInput.error),
        },
        { status: 422 },
      );
    }

    const input = parsedInput.data;
    const existingAuth = await auth();
    const channel: QuoteChannel = existingAuth?.user?.id ? "admin" : "web";

    if (!input.dryRun && input.idempotencyKey) {
      const existingBooking = await prisma.booking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          appliedMarkupRule: {
            select: {
              id: true,
              scope: true,
            },
          },
          pnrs: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (existingBooking) {
        return NextResponse.json(responseFromExistingBooking(existingBooking));
      }
    }

    const quote = await quoteBooking(input, channel);
    const priceDelta = toPriceDeltaPayload(comparePrices(input.displayedNetPrice, quote.totalNetPrice));
    const markupRuleApplied = firstMarkupRule(quote);

    if (input.dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        orderCode: null,
        netPrice: quote.totalNetPrice.toFixed(0),
        markupAmount: quote.totalMarkupAmount.toFixed(0),
        sellPrice: quote.totalSellPrice.toFixed(0),
        currency: quote.currency,
        holdExpiresAt: quote.expiresAt,
        totalAmount: Number(quote.totalSellPrice.toFixed(0)),
        markupRuleApplied,
        priceDelta,
        pricing: {
          verified: true,
          source: "admin-quote",
          totalAmount: Number(quote.totalSellPrice.toFixed(0)),
          currency: quote.currency,
          byPnr: [],
          unresolvedPnrs: [],
          syncedAt: new Date().toISOString(),
        },
        pnrs: [],
      });
    }

    const actorId = existingAuth?.user?.id ?? null;
    const passengerCounts = countPassengers(input.passengers);
    const legacyPassengers = toLegacyPassengers(input.passengers);
    const holdPayload = {
      flight: normalized.outboundFlight,
      outbound: normalized.outboundFlight,
      inbound: normalized.inboundFlight,
      tripType: input.tripType === "ROUNDTRIP" ? "roundtrip" : "oneway",
      search: input.search,
      adults: passengerCounts.adt,
      children: passengerCounts.chd,
      infants: passengerCounts.inf,
      cabin: input.cabin as "economy" | "premium" | "business" | "first" | undefined,
      passenger: legacyPassengers[0],
      passengers: legacyPassengers,
      contact: {
        fullName: input.contact.fullName,
        phone: input.contact.phone,
        email: input.contact.email,
      },
      dryRun: false,
      idempotencyKey: input.idempotencyKey,
    } satisfies Parameters<typeof holdNamThanhBooking>[0];
    const holdResult = await holdNamThanhBooking(holdPayload, input.idempotencyKey);
    const holdExpiresAt = deriveHoldExpiresAt(quote, holdResult);
    const firstActualPnr = (holdResult.pnrs || []).find((pnr) => pnr.pnr)?.pnr ?? null;
    const firstRuleId = quote.legs.length > 0 && quote.legs.every((leg) => leg.markupRule?.id === quote.legs[0]?.markupRule?.id)
      ? quote.legs[0]?.markupRule?.id ?? null
      : null;
    const auditMeta = getAuditRequestMeta();

    const booking = await prisma.$transaction(async (tx) => {
      const existingCustomer =
        input.contact.email || input.contact.phone
          ? await tx.customer.findFirst({
              where: {
                OR: [
                  input.contact.email ? { email: input.contact.email } : undefined,
                  input.contact.phone ? { phone: input.contact.phone } : undefined,
                ].filter(Boolean) as { email?: string; phone?: string }[],
              },
              orderBy: { createdAt: "asc" },
            })
          : null;

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              fullName: input.contact.fullName,
              phone: input.contact.phone,
              email: input.contact.email,
            },
          })
        : await tx.customer.create({
            data: {
              fullName: input.contact.fullName,
              phone: input.contact.phone,
              email: input.contact.email,
              createdById: actorId,
            },
          });
      const orderCode = await generateUniqueOrderCode(tx);

      const createdBooking = await tx.booking.create({
        data: {
          orderCode,
          pnr: firstActualPnr,
          sessionId: typeof holdResult.sessionID === "number" ? holdResult.sessionID : null,
          searchId: input.outbound.searchId ?? null,
          idempotencyKey: input.idempotencyKey,
          airline: normalized.outboundFlight.airlineCode || null,
          routeSummary: routeSummary(input),
          departAt: parseDateTime(normalized.outboundFlight.departure.time),
          returnAt: normalized.inboundFlight ? parseDateTime(normalized.inboundFlight.departure.time) : null,
          tripType: input.tripType,
          adt: passengerCounts.adt,
          chd: passengerCounts.chd,
          inf: passengerCounts.inf,
          cabin: input.cabin ?? null,
          netAmount: Number(quote.totalNetPrice.toFixed(0)),
          saleAmount: Number(quote.totalSellPrice.toFixed(0)),
          markupAmount: Number(quote.totalMarkupAmount.toFixed(0)),
          serviceFeeAmount: Number(quote.totalServiceFeeAmount.toFixed(0)),
          profit: Number(quote.totalSellPrice.minus(quote.totalNetPrice).toFixed(0)),
          currency: quote.currency,
          status: BookingStatus.HELD,
          ttlExpiresAt: holdExpiresAt ? new Date(holdExpiresAt) : null,
          customerId: customer.id,
          createdById: actorId,
          channel,
          source: "namthanh",
          priceLockedAt: new Date(),
          appliedMarkupRuleId: firstRuleId,
          appliedMarkupRuleSnapshot: toJsonValue(serializeQuote(quote)),
          namthanhRawJson: toJsonValue({
            request: {
              tripType: input.tripType,
              passengers: input.passengers.map((passenger) => ({
                type: passenger.type,
                firstName: passenger.firstName,
                lastName: passenger.lastName,
                dob: passenger.dob,
              })),
              contact: input.contact,
            },
            quote: serializeQuote(quote),
            holdResult,
            priceDelta,
          }),
        },
      });

      const pnrItems = buildHoldPnrRecords(input, quote, holdResult, createdBooking.id, holdExpiresAt);

      await tx.bookingPnr.createMany({
        data: pnrItems,
      });

      await tx.bookingTimelineEvent.create({
        data: {
          bookingId: createdBooking.id,
          pnr: firstActualPnr,
          source: "namthanh",
          eventType: "HOLD_CREATED",
          title: "Tạo giữ chỗ từ hold pipeline",
          payload: toJsonValue({
            quote: serializeQuote(quote),
            holdResult,
            priceDelta,
          }),
          occurredAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Booking",
          entityId: createdBooking.id,
          action: "booking.hold",
          before: Prisma.JsonNull,
          after: toJsonValue({
            status: createdBooking.status,
            pnr: createdBooking.pnr,
            netAmount: createdBooking.netAmount,
            markupAmount: createdBooking.markupAmount,
            saleAmount: createdBooking.saleAmount,
            priceDelta,
          }),
          ip: auditMeta.ip,
          userAgent: auditMeta.userAgent,
        },
      });

      return createdBooking;
    });

    let paymentIntentResult: Awaited<ReturnType<typeof createPaymentIntentForBooking>> | null = null;

    try {
      paymentIntentResult = await createPaymentIntentForBooking(booking.id, actorId);
    } catch (error) {
      if (error instanceof PaymentIntentError) {
        console.error("create payment intent after hold failed", {
          bookingId: booking.id,
          code: error.code,
          message: error.message,
        });
      } else {
        console.error("create payment intent after hold failed", error);
      }
    }

    if (paymentIntentResult?.intent) {
      void notify({
        type: "INTERNAL_ALERT",
        severity: "info",
        message: `Hold thành công và đã tạo QR payOS cho ${firstActualPnr ?? booking.id}`,
        context: {
          bookingId: booking.id,
          pnr: firstActualPnr,
          paymentIntentId: paymentIntentResult.intent.id,
          amount: paymentIntentResult.intent.amount,
          reused: paymentIntentResult.reused,
        },
      });
    } else {
      void notify({ type: "BOOKING_HOLD", bookingId: booking.id });
      void notify({
        type: "INTERNAL_ALERT",
        severity: "warn",
        message: `Hold thành công nhưng chưa tạo được QR payOS cho ${firstActualPnr ?? booking.id}`,
        context: {
          bookingId: booking.id,
          pnr: firstActualPnr,
        },
      });
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      orderCode: booking.orderCode,
      pnr: firstActualPnr ?? undefined,
      netPrice: quote.totalNetPrice.toFixed(0),
      markupAmount: quote.totalMarkupAmount.toFixed(0),
      sellPrice: quote.totalSellPrice.toFixed(0),
      currency: quote.currency,
      holdExpiresAt,
      markupRuleApplied,
      priceDelta,
      dryRun: false,
      totalAmount: Number(quote.totalSellPrice.toFixed(0)),
      sessionID: holdResult.sessionID,
      passenger: input.contact.fullName,
      paymentIntent: paymentIntentResult
        ? {
            id: paymentIntentResult.intent.id,
            status: paymentIntentResult.intent.status,
            amount: paymentIntentResult.intent.amount,
            checkoutUrl: paymentIntentResult.intent.checkoutUrl,
            transferContent: paymentIntentResult.intent.transferContent,
            expiresAt: paymentIntentResult.intent.expiresAt?.toISOString() ?? null,
            reused: paymentIntentResult.reused,
          }
        : null,
      pricing: {
        verified: true,
        source: "admin-quote",
        totalAmount: Number(quote.totalSellPrice.toFixed(0)),
        currency: quote.currency,
        byPnr: serializePnrPricing(quote, holdResult.pnrs || []),
        unresolvedPnrs: [],
        syncedAt: new Date().toISOString(),
      },
      pnrs: holdResult.pnrs || [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fieldErrors: zodFieldErrors(error),
        },
        { status: 422 },
      );
    }

    const quoteError = quoteErrorResponse(error);

    if (quoteError) {
      return quoteError;
    }

    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "UPSTREAM_UNAVAILABLE",
        detail: message,
      },
      { status: 502 },
    );
  }
}
