// Hành trình chuyến bay (itinerary) dùng chung cho admin OpenFly.
//
// Mục tiêu: lưu & hiển thị đầy đủ thông tin chuyến bay (số hiệu, chặng, giờ đi/đến,
// loại máy bay) cho từng đơn — kể cả đơn cũ chưa lưu itinerary.
//
// Nguồn dữ liệu theo thứ tự ưu tiên khi đọc (extractItinerary):
//   1) namthanhRawJson.itinerary       — đơn tạo sau bản vá này (đầy đủ nhất)
//   2) namthanhRawJson.quote.legs       — đơn cũ: có route/giờ/hãng/khoang
//      + namthanhRawJson.holdResult.flight.segments — bổ sung số hiệu chặng đi
//   3) booking.routeSummary             — tối thiểu: chỉ còn route + giờ tổng

import type { FlightResult } from "@/lib/types";

export type ItineraryDirection = "outbound" | "inbound";
export type ItinerarySource = "stored" | "quote" | "route";

export interface ItinerarySegment {
  carrierCode: string | null;
  flightNumber: string | null;
  from: string | null;
  to: string | null;
  fromName?: string | null;
  toName?: string | null;
  departAt: string | null; // ISO 8601
  arrivalAt: string | null; // ISO 8601
  aircraft?: string | null;
  durationMinutes?: number | null;
}

export interface ItineraryLeg {
  direction: ItineraryDirection;
  route: string; // "HAN-SGN"
  airline: string | null;
  airlineCode: string | null;
  cabin: string | null;
  departAt: string | null; // ISO 8601
  arrivalAt: string | null; // ISO 8601
  durationMinutes: number | null;
  stops: number | null;
  segments: ItinerarySegment[];
}

export interface Itinerary {
  legs: ItineraryLeg[];
  source: ItinerarySource;
}

/** Booking tối thiểu cần để dựng lại itinerary (đủ tách khỏi Prisma type). */
export interface ItinerarySourceBooking {
  namthanhRawJson: unknown;
  routeSummary: string | null;
  airline: string | null;
  cabin: string | null;
  departAt: Date | string | null;
  returnAt: Date | string | null;
}

// ----- helpers cơ bản -----

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function upper(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function upperOrNull(value: string | null | undefined): string | null {
  const result = upper(value);
  return result || null;
}

/** Parse cả ISO ("2026-06-30T21:25:00+07:00") lẫn "dd-mm-yyyy HH:mm" → ISO string. */
function toIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+|T)?(\d{2}):(\d{2})/);
  if (dmy) {
    const parsed = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}:${dmy[5]}:00+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

/** Ghép mã hãng + số hiệu: ("VJ","163") → "VJ163"; ("VJ","VJ163") → "VJ163". */
function fullFlightNumber(carrierCode: string | null | undefined, flightNumber: string | null | undefined): string | null {
  const numberPart = (flightNumber ?? "").trim();
  if (!numberPart) {
    return null;
  }

  const code = upper(carrierCode);
  const upperNumber = numberPart.toUpperCase();

  if (code && !upperNumber.startsWith(code)) {
    return `${code}${upperNumber}`;
  }

  return upperNumber;
}

function syntheticSegment(route: string, airline: string | null, departAt: string | null, arrivalAt: string | null): ItinerarySegment {
  const [from, to] = route.split("-").map((part) => upperOrNull(part));
  return {
    carrierCode: airline,
    flightNumber: null,
    from: from ?? null,
    to: to ?? null,
    departAt,
    arrivalAt,
    aircraft: null,
    durationMinutes: null,
  };
}

// ----- BUILD: FlightResult → itinerary (dùng khi tạo hold) -----

function segmentsFromFlightResult(flight: FlightResult): ItinerarySegment[] {
  const ntSegments = flight.namthanh?.segments;

  if (Array.isArray(ntSegments) && ntSegments.length > 0) {
    return ntSegments.map((seg) => {
      const carrier = str(seg.carrierCode) ?? str(seg.airlineCode) ?? flight.airlineCode ?? null;
      return {
        carrierCode: carrier,
        flightNumber: fullFlightNumber(carrier, str(seg.flightNumber)),
        from: upperOrNull(str(seg.from)),
        to: upperOrNull(str(seg.to)),
        departAt: toIso(seg.departDate),
        arrivalAt: toIso(seg.arrivalDate),
        aircraft: str(seg.airCraft),
        durationMinutes: num(seg.duration),
      } satisfies ItinerarySegment;
    });
  }

  return [
    {
      carrierCode: flight.airlineCode ?? null,
      flightNumber: fullFlightNumber(flight.airlineCode, flight.flightNumber),
      from: upperOrNull(flight.departure?.airport),
      to: upperOrNull(flight.arrival?.airport),
      fromName: flight.departure?.airportName ?? null,
      toName: flight.arrival?.airportName ?? null,
      departAt: toIso(flight.departure?.time),
      arrivalAt: toIso(flight.arrival?.time),
      aircraft: null,
      durationMinutes: num(flight.duration),
    },
  ];
}

export function flightToItineraryLeg(flight: FlightResult, direction: ItineraryDirection, cabin?: string | null): ItineraryLeg {
  const segments = segmentsFromFlightResult(flight);
  return {
    direction,
    route: `${upper(flight.departure?.airport)}-${upper(flight.arrival?.airport)}`,
    airline: flight.airline || flight.airlineCode || null,
    airlineCode: flight.airlineCode || null,
    cabin: cabin ?? flight.namthanh?.cabinClass ?? null,
    departAt: toIso(flight.departure?.time),
    arrivalAt: toIso(flight.arrival?.time),
    durationMinutes: num(flight.duration),
    stops: num(flight.stops) ?? Math.max(0, segments.length - 1),
    segments,
  };
}

/** Dựng itinerary để lưu vào namthanhRawJson.itinerary lúc tạo hold. */
export function buildItinerary(
  outbound: FlightResult,
  inbound: FlightResult | undefined,
  cabin: string | null | undefined,
): { legs: ItineraryLeg[] } {
  const legs: ItineraryLeg[] = [flightToItineraryLeg(outbound, "outbound", cabin)];
  if (inbound) {
    legs.push(flightToItineraryLeg(inbound, "inbound", cabin));
  }
  return { legs };
}

// ----- EXTRACT: đọc itinerary để hiển thị -----

function normalizeStoredSegment(value: Record<string, unknown>): ItinerarySegment {
  return {
    carrierCode: str(value.carrierCode),
    flightNumber: str(value.flightNumber),
    from: str(value.from),
    to: str(value.to),
    fromName: str(value.fromName),
    toName: str(value.toName),
    departAt: str(value.departAt),
    arrivalAt: str(value.arrivalAt),
    aircraft: str(value.aircraft),
    durationMinutes: num(value.durationMinutes),
  };
}

function normalizeStoredLeg(value: Record<string, unknown>): ItineraryLeg | null {
  const route = str(value.route);
  if (!route) {
    return null;
  }

  const direction: ItineraryDirection = value.direction === "inbound" ? "inbound" : "outbound";
  const segments = arrayOf(value.segments).map(normalizeStoredSegment);

  return {
    direction,
    route,
    airline: str(value.airline),
    airlineCode: str(value.airlineCode),
    cabin: str(value.cabin),
    departAt: str(value.departAt),
    arrivalAt: str(value.arrivalAt),
    durationMinutes: num(value.durationMinutes),
    stops: num(value.stops),
    segments: segments.length > 0 ? segments : [syntheticSegment(route, str(value.airline), str(value.departAt), str(value.arrivalAt))],
  };
}

function normalizeStoredLegs(value: unknown): ItineraryLeg[] {
  return arrayOf(recordOf(value).legs)
    .map(normalizeStoredLeg)
    .filter((leg): leg is ItineraryLeg => leg !== null);
}

function segmentsFromHoldFlight(flight: Record<string, unknown>): ItinerarySegment[] {
  return arrayOf(flight.segments).map((seg) => {
    const carrier = str(seg.carrierCode) ?? str(seg.airlineCode);
    return {
      carrierCode: carrier,
      flightNumber: fullFlightNumber(carrier, str(seg.flightNumber)),
      from: upperOrNull(str(seg.from)),
      to: upperOrNull(str(seg.to)),
      departAt: toIso(seg.departDate),
      arrivalAt: toIso(seg.arrivalDate),
      aircraft: str(seg.airCraft),
      durationMinutes: num(seg.duration),
    } satisfies ItinerarySegment;
  });
}

function collectHoldSegments(holdResult: unknown): { outbound: ItinerarySegment[]; inbound: ItinerarySegment[] } {
  const top = recordOf(holdResult);
  const legs = recordOf(top.legs);

  const topFlight = segmentsFromHoldFlight(recordOf(top.flight));
  const outboundLegFlight = segmentsFromHoldFlight(recordOf(recordOf(legs.outbound).flight));
  const inboundLegFlight = segmentsFromHoldFlight(recordOf(recordOf(legs.inbound).flight));

  return {
    outbound: outboundLegFlight.length > 0 ? outboundLegFlight : topFlight,
    inbound: inboundLegFlight,
  };
}

/** Chọn segment hold cho leg, có kiểm tra điểm đầu/cuối khớp route để tránh gán nhầm chiều. */
function pickHoldSegments(
  pools: { outbound: ItinerarySegment[]; inbound: ItinerarySegment[] },
  route: string,
  direction: ItineraryDirection,
): ItinerarySegment[] {
  const pool = direction === "inbound" ? pools.inbound : pools.outbound;
  if (pool.length === 0) {
    return [];
  }

  const [origin, dest] = route.split("-").map((part) => upper(part));
  if (!origin && !dest) {
    return pool;
  }

  const relevant = pool.some((seg) => upper(seg.from) === origin || upper(seg.to) === dest);
  return relevant ? pool : [];
}

function legFromQuoteLeg(
  quoteLeg: Record<string, unknown>,
  index: number,
  holdSegments: { outbound: ItinerarySegment[]; inbound: ItinerarySegment[] },
  booking: ItinerarySourceBooking,
): ItineraryLeg | null {
  const route = str(quoteLeg.route);
  if (!route) {
    return null;
  }

  const legKey = str(quoteLeg.legKey);
  const direction: ItineraryDirection = legKey === "inbound" ? "inbound" : legKey === "outbound" ? "outbound" : index === 0 ? "outbound" : "inbound";
  const airline = str(quoteLeg.airline) ?? booking.airline;
  const cabin = str(quoteLeg.cabin) ?? booking.cabin;
  const departAt = toIso(quoteLeg.departureAt);
  const arrivalAt = toIso(quoteLeg.arrivalAt);

  const matchedSegments = pickHoldSegments(holdSegments, route, direction);
  const segments = matchedSegments.length > 0 ? matchedSegments : [syntheticSegment(route, airline, departAt, arrivalAt)];

  return {
    direction,
    route,
    airline,
    airlineCode: airline,
    cabin,
    departAt,
    arrivalAt,
    durationMinutes: null,
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

function legsFromRouteSummary(booking: ItinerarySourceBooking): ItineraryLeg[] {
  const summary = str(booking.routeSummary);
  if (!summary) {
    return [];
  }

  const tokens = summary
    .split("/")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  return tokens.map((route, index) => {
    const direction: ItineraryDirection = index === 0 ? "outbound" : "inbound";
    const departAt = toIso(index === 0 ? booking.departAt : booking.returnAt);
    const airline = booking.airline;
    return {
      direction,
      route,
      airline,
      airlineCode: airline,
      cabin: booking.cabin,
      departAt,
      arrivalAt: null,
      durationMinutes: null,
      stops: 0,
      segments: [syntheticSegment(route, airline, departAt, null)],
    } satisfies ItineraryLeg;
  });
}

/** Đọc itinerary của một booking với chuỗi fallback stored → quote → route. */
export function extractItinerary(booking: ItinerarySourceBooking): Itinerary | null {
  const raw = recordOf(booking.namthanhRawJson);

  const storedLegs = normalizeStoredLegs(raw.itinerary);
  if (storedLegs.length > 0) {
    return { legs: storedLegs, source: "stored" };
  }

  const quoteLegs = arrayOf(recordOf(raw.quote).legs);
  if (quoteLegs.length > 0) {
    const holdSegments = collectHoldSegments(raw.holdResult);
    const legs = quoteLegs
      .map((quoteLeg, index) => legFromQuoteLeg(quoteLeg, index, holdSegments, booking))
      .filter((leg): leg is ItineraryLeg => leg !== null);
    if (legs.length > 0) {
      return { legs, source: "quote" };
    }
  }

  const routeLegs = legsFromRouteSummary(booking);
  if (routeLegs.length > 0) {
    return { legs: routeLegs, source: "route" };
  }

  return null;
}
