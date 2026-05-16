import type {
  BookingAncillaryResponse,
  FlightResult,
  RoundtripPairOption,
  HoldBookingPricing,
  HoldBookingRequest,
  HoldBookingPassenger,
  HoldBookingResponse,
  SearchPayload,
  SearchResponse,
} from './types';
import { getAirlineMeta } from './airlines';
import { getVndUsdRate, getCachedVndUsdRate } from './exchange';

const DEFAULT_BACKEND_URL = 'http://localhost:3100';

export class NamThanhApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'NamThanhApiError';
    this.status = status;
    this.details = details;
  }
}

export interface LowestFareDay {
  day: number;
  month: number;
  year: number;
  fareAmount: number;
  fareDisplay?: string;
}

export interface NamThanhLowestFareResponse {
  route: {
    origin: string;
    destination: string;
  };
  depart: Record<string, LowestFareDay[]>;
  return: Record<string, LowestFareDay[]>;
  currency: string;
  cachedAt: string;
  ttlSeconds: number;
}

function backendUrl() {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function backendHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return { ...headers, ...extra };
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const SEARCH_FLIGHT_PRESENTATION_LIMIT = envNumber('SEARCH_FLIGHT_PRESENTATION_LIMIT', 120);
const SEARCH_PAIR_PRESENTATION_LIMIT = envNumber('SEARCH_PAIR_PRESENTATION_LIMIT', 140);
const SEARCH_PAIR_SOURCE_LIMIT = envNumber('SEARCH_PAIR_SOURCE_LIMIT', 70);

async function namThanhFetch<T>(path: string, init: RequestInit = {}, timeoutMs = 180_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const targetUrl = /^https?:\/\//i.test(path) ? path : `${backendUrl()}${path}`;
    const res = await fetch(targetUrl, {
      ...init,
      headers: backendHeaders(init.headers),
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok || data?.success === false) {
      throw new NamThanhApiError(
        data?.error || data?.message || `Nam Thanh backend error ${res.status}`,
        res.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof NamThanhApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NamThanhApiError('Nam Thanh backend timeout', 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getNamThanhLowestFare(params: {
  origin: string;
  destination: string;
}): Promise<NamThanhLowestFareResponse> {
  const url = new URL('/flights/lowest-fare', backendUrl());
  url.searchParams.set('origin', params.origin);
  url.searchParams.set('destination', params.destination);

  return namThanhFetch<NamThanhLowestFareResponse>(url.toString(), { method: 'GET' }, 30_000);
}

export function normalizeFlight(flight: FlightResult, searchId?: string, rate?: number): FlightResult {
  const airlineResolved = resolveHybridAirlineInfo(flight);
  const fareTotal = flight.fareBreakdown?.totalAmount ?? flight.price?.amount ?? 0;
  const usdRate = rate && Number.isFinite(rate) && rate > 0 ? rate : getCachedVndUsdRate();
  return {
    ...flight,
    searchId: flight.searchId || searchId,
    fareId: flight.fareId || flight.namthanh?.fareId,
    airlineCode: airlineResolved.code,
    airline: airlineResolved.name,
    airlineLogo: airlineResolved.logo,
    price: {
      amount: Number(fareTotal),
      currency: 'VND',
      source: 'namthanh',
    },
    priceUSD: Math.round(Number(fareTotal) / usdRate),
    sources: Array.from(new Set([...(flight.sources || []), 'namthanh', 'muadi'])),
  };
}

export function normalizePairOption(
  pair: RoundtripPairOption,
  searchId?: string,
  rate?: number
): RoundtripPairOption {
  const outbound = normalizeFlight(pair.outbound, searchId, rate);
  const inbound = normalizeFlight(pair.inbound, searchId, rate);
  const totalAmount = Number(pair.totalAmount || 0) || Number(outbound.price.amount || 0) + Number(inbound.price.amount || 0);
  const usdRate = rate && Number.isFinite(rate) && rate > 0 ? rate : getCachedVndUsdRate();
  return {
    ...pair,
    source: normalizePairSource(pair.source || pair.systemName || ''),
    systemName: toText(pair.systemName || pair.source || '') || undefined,
    outbound,
    inbound,
    totalAmount,
    currency: 'VND',
    totalUSD: Number.isFinite(Number(pair.totalUSD)) && Number(pair.totalUSD) > 0
      ? Number(pair.totalUSD)
      : Math.round(totalAmount / usdRate),
    airlines: Array.from(new Set(pair.airlines || [outbound.airlineCode, inbound.airlineCode].filter(Boolean))),
    stops: Number.isFinite(Number(pair.stops))
      ? Number(pair.stops)
      : Number(outbound.stops || 0) + Number(inbound.stops || 0),
    outboundFlightId: pair.outboundFlightId || outbound.id,
    outboundFareId: pair.outboundFareId || outbound.fareId,
    inboundFlightId: pair.inboundFlightId || inbound.id,
    inboundFareId: pair.inboundFareId || inbound.fareId,
  };
}

const SEAT_COUNT_KEYS = [
  'seatAvailable',
  'seatsAvailable',
  'availableSeats',
  'remainingSeats',
  'seatLeft',
  'seatsLeft',
];

const SOLD_OUT_FLAG_KEYS = [
  'soldOut',
  'soldout',
  'isSoldOut',
  'unavailable',
  'isUnavailable',
  'closed',
  'isClosed',
];

const AVAILABLE_FLAG_KEYS = [
  'available',
  'isAvailable',
  'bookable',
  'isBookable',
];

const AVAILABILITY_TEXT_KEYS = [
  'status',
  'message',
  'fareStatus',
  'availabilityStatus',
  'displayStatus',
  'inventoryStatus',
];

function normalizedAvailabilityText(value: unknown): string {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function booleanFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  const text = normalizedAvailabilityText(value);
  if (['true', '1', 'yes', 'y', 'available', 'bookable'].includes(text)) return true;
  if (['false', '0', 'no', 'n', 'unavailable', 'soldout', 'sold out'].includes(text)) return false;
  return null;
}

function numericSeatCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function seatCountFromRecord(record: LooseRecord | null): number | null {
  if (!record) return null;
  for (const key of SEAT_COUNT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const count = numericSeatCount(record[key]);
      if (count !== null) return count;
    }
  }
  return null;
}

function recordHasUnavailableSignal(record: LooseRecord | null): boolean {
  if (!record) return false;

  for (const key of SOLD_OUT_FLAG_KEYS) {
    const flag = booleanFlag(record[key]);
    if (flag === true) return true;
  }

  for (const key of AVAILABLE_FLAG_KEYS) {
    const flag = booleanFlag(record[key]);
    if (flag === false) return true;
  }

  for (const key of AVAILABILITY_TEXT_KEYS) {
    const text = normalizedAvailabilityText(record[key]);
    if (!text) continue;
    if (
      text.includes('sold out') ||
      text.includes('soldout') ||
      text.includes('no seat') ||
      text.includes('no seats') ||
      text.includes('no availability') ||
      text.includes('not available') ||
      text.includes('unavailable') ||
      text.includes('het cho') ||
      text.includes('het ve')
    ) {
      return true;
    }
  }

  return false;
}

function fareOptionMatchesSelected(flight: FlightResult, option: NonNullable<FlightResult['fareOptions']>[number]) {
  const fareId = toText(flight.fareId || flight.namthanh?.fareId);
  if (fareId && option.id === fareId) return true;

  const fareClass = toText(flight.namthanh?.class).toUpperCase();
  const fareBasis = toText(flight.namthanh?.fareBasis).toUpperCase();
  const optionClass = toText(option.class).toUpperCase();
  const optionBasis = toText(option.fareBasis).toUpperCase();

  return !!(
    (fareClass && optionClass && fareClass === optionClass) &&
    (!fareBasis || !optionBasis || fareBasis === optionBasis)
  );
}

function selectedFareOption(flight: FlightResult) {
  const options = flight.fareOptions || [];
  if (!options.length) return null;
  return options.find((option) => fareOptionMatchesSelected(flight, option)) || null;
}

function recordSeatIsBookable(record: LooseRecord | null): boolean | null {
  const count = seatCountFromRecord(record);
  return count === null ? null : count > 0;
}

export function isFlightBookable(flight: FlightResult): boolean {
  const flightRecord = asRecord(flight as unknown);
  const namThanhRecord = asRecord(flight.namthanh as unknown);

  if (recordHasUnavailableSignal(flightRecord) || recordHasUnavailableSignal(namThanhRecord)) {
    return false;
  }

  const selectedOption = selectedFareOption(flight);
  if (selectedOption) {
    const selectedRecord = asRecord(selectedOption);
    if (recordHasUnavailableSignal(selectedRecord)) return false;
    const selectedSeats = recordSeatIsBookable(selectedRecord);
    if (selectedSeats !== null) return selectedSeats;
  }

  const namThanhSeats = recordSeatIsBookable(namThanhRecord);
  if (namThanhSeats !== null) return namThanhSeats;

  const flightSeats = recordSeatIsBookable(flightRecord);
  if (flightSeats !== null) return flightSeats;

  const options = flight.fareOptions || [];
  if (options.length) {
    let sawExplicitAvailability = false;
    let sawBookableOption = false;

    for (const option of options) {
      const optionRecord = asRecord(option);
      if (recordHasUnavailableSignal(optionRecord)) {
        sawExplicitAvailability = true;
        continue;
      }

      const optionSeats = recordSeatIsBookable(optionRecord);
      if (optionSeats !== null) {
        sawExplicitAvailability = true;
        if (optionSeats) sawBookableOption = true;
      } else {
        sawBookableOption = true;
      }
    }

    if (sawExplicitAvailability && !sawBookableOption) return false;
  }

  return true;
}

export function isPairOptionBookable(pair: RoundtripPairOption): boolean {
  return isFlightBookable(pair.outbound) && isFlightBookable(pair.inbound);
}

function trimFlightsForSearch(flights: FlightResult[]) {
  return flights.slice(0, SEARCH_FLIGHT_PRESENTATION_LIMIT);
}

function pairPresentationSource(pair: RoundtripPairOption) {
  return normalizePairSource(pair.source || pair.systemName || '') || 'unknown';
}

function trimPairsForSearch(pairs: RoundtripPairOption[]) {
  if (pairs.length <= SEARCH_PAIR_PRESENTATION_LIMIT) return pairs;

  const sourceCounts = new Map<string, number>();
  const selected: RoundtripPairOption[] = [];
  const selectedIds = new Set<string>();

  for (const pair of pairs) {
    const source = pairPresentationSource(pair);
    const count = sourceCounts.get(source) || 0;
    if (count >= SEARCH_PAIR_SOURCE_LIMIT) continue;

    selected.push(pair);
    selectedIds.add(pair.id);
    sourceCounts.set(source, count + 1);
    if (selected.length >= SEARCH_PAIR_PRESENTATION_LIMIT) break;
  }

  if (selected.length < SEARCH_PAIR_PRESENTATION_LIMIT) {
    for (const pair of pairs) {
      if (selectedIds.has(pair.id)) continue;
      selected.push(pair);
      if (selected.length >= SEARCH_PAIR_PRESENTATION_LIMIT) break;
    }
  }

  return selected.sort((a, b) => a.totalAmount - b.totalAmount);
}

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' ? (value as LooseRecord) : null;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
}

function pickFirstText(values: unknown[]): string {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
}

function cleanAirlineName(value: unknown): string {
  const text = toText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/^1[A-Z0-9]$/i.test(text)) return '';
  if (/^(gds|amadeus|sabre)$/i.test(text)) return '';
  return text;
}

function normalizeAirlineCode(value: unknown): string {
  return toText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizePairSource(value: unknown): string {
  const text = toText(value).toUpperCase();
  if (!text) return '';
  if (/^1[A-Z0-9]$/.test(text)) return text;
  const match = text.match(/(?:^|[^A-Z0-9])(1[A-Z0-9])$/);
  return match ? match[1] : text;
}

function isGenericProviderCode(code: string): boolean {
  return /^1[A-Z0-9]$/i.test(code);
}

function resolveHybridAirlineInfo(flight: FlightResult): { code: string; name: string; logo?: string } {
  const flightRecord = asRecord(flight as unknown);
  const namThanhRecord = asRecord(flight.namthanh as unknown);
  const segmentRecords = Array.isArray(flight.namthanh?.segments)
    ? flight.namthanh.segments
      .map((segment) => asRecord(segment))
      .filter((segment): segment is LooseRecord => !!segment)
    : [];

  const segmentCode = normalizeAirlineCode(pickFirstText([
    ...segmentRecords.map((segment) => segment.carrierCode),
    ...segmentRecords.map((segment) => segment.airlineCode),
    ...segmentRecords.map((segment) => segment.marketingCarrierCode),
    ...segmentRecords.map((segment) => segment.operatingCarrierCode),
    ...segmentRecords.map((segment) => segment.carrier),
    ...segmentRecords.map((segment) => segment.airline),
  ]));

  const apiCode = normalizeAirlineCode(pickFirstText([
    flightRecord?.airlineCode,
    flightRecord?.carrierCode,
    flightRecord?.airline_code,
    namThanhRecord?.carrierCode,
    namThanhRecord?.airlineCode,
    namThanhRecord?.airline_code,
    flight.airlineCode,
  ]));

  const flightNumberCode = normalizeAirlineCode((toText(flight.flightNumber).match(/^([A-Z0-9]{2})/) || [])[1]);
  const codeCandidate =
    segmentCode ||
    (!isGenericProviderCode(apiCode) ? apiCode : '') ||
    flightNumberCode ||
    apiCode ||
    normalizeAirlineCode(flight.airlineCode);

  const apiName = cleanAirlineName(pickFirstText([
    flightRecord?.airlineName,
    flightRecord?.carrierName,
    namThanhRecord?.airlineName,
    namThanhRecord?.carrierName,
    flight.airline,
  ]));

  const segmentName = cleanAirlineName(pickFirstText([
    ...segmentRecords.map((segment) => segment.carrierName),
    ...segmentRecords.map((segment) => segment.airlineName),
    ...segmentRecords.map((segment) => segment.marketingCarrierName),
    ...segmentRecords.map((segment) => segment.operatingCarrierName),
  ]));

  const nameCandidate = apiName || segmentName || cleanAirlineName(flight.airline);

  const explicitLogo = pickFirstText([
    flightRecord?.airlineLogo,
    flightRecord?.airline_logo,
    flightRecord?.logoUrl,
    flightRecord?.logo,
    namThanhRecord?.airlineLogo,
    namThanhRecord?.airline_logo,
    namThanhRecord?.logoUrl,
    namThanhRecord?.logo,
    ...segmentRecords.map((segment) => segment.airlineLogo),
    ...segmentRecords.map((segment) => segment.logoUrl),
    ...segmentRecords.map((segment) => segment.logo),
  ]);

  const meta = getAirlineMeta(codeCandidate, nameCandidate || flight.airline, explicitLogo);
  const code = meta.code || codeCandidate || normalizeAirlineCode(flight.airlineCode);
  const name = cleanAirlineName(meta.name) || nameCandidate || cleanAirlineName(flight.airline) || code || 'Unknown Airline';

  return {
    code,
    name,
    logo: meta.logo || undefined,
  };
}

function flightDate(flight?: FlightResult): string {
  const value = String(flight?.departure?.time || '');
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function flightTime(flight?: FlightResult): string {
  const value = String(flight?.departure?.time || '');
  const direct = value.match(/T(\d{2}:\d{2})|(?:^|\s)(\d{1,2}:\d{2})/);
  if (direct) return (direct[1] || direct[2] || '').padStart(5, '0');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function cleanRouteCode(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function cleanAirlineCode(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function routeCodesFromFlight(flight?: FlightResult): Set<string> {
  const codes = new Set<string>();
  if (!flight) return codes;
  const direct = `${flight.departure?.airport || ''}${flight.arrival?.airport || ''}`;
  if (direct) codes.add(cleanRouteCode(direct));
  for (const segment of flight.namthanh?.segments || []) {
    const route = `${segment.from || ''}${segment.to || ''}`;
    if (route) codes.add(cleanRouteCode(route));
  }
  return codes;
}

function keepServicesForFlight(passengers: HoldBookingPassenger[] | undefined, flight?: FlightResult) {
  if (!passengers || passengers.length === 0) return passengers;
  const acceptedRoutes = routeCodesFromFlight(flight);
  const flightAirline = cleanAirlineCode(flight?.airlineCode || flight?.namthanh?.source);
  if (acceptedRoutes.size === 0 && !flightAirline) return passengers;

  const keepByFlight = (item: { route?: string; airline?: string }) => {
    const itemAirline = cleanAirlineCode(item.airline);
    if (itemAirline && flightAirline && itemAirline !== flightAirline) {
      return false;
    }

    const route = cleanRouteCode(item.route || '');
    if (!route || acceptedRoutes.size === 0) {
      return true;
    }

    return acceptedRoutes.has(route);
  };

  return passengers.map((passenger) => ({
    ...passenger,
    listLuggage: (passenger.listLuggage || []).filter((item) => keepByFlight(item)),
    ancillaryServices: (passenger.ancillaryServices || []).filter((item) => keepByFlight(item)),
  }));
}

function hasCachedSelection(flight?: FlightResult) {
  if (!flight) return false;
  const searchId = String(flight.searchId || '').trim();
  const flightId = String(flight.id || flight.namthanh?.flightId || '').trim();
  return !!(searchId && flightId);
}

function isVietjetFlight(flight?: FlightResult) {
  const airlineCode = String(flight?.airlineCode || flight?.namthanh?.source || '').trim().toUpperCase();
  return airlineCode === 'VJ';
}

export function isSearchCacheMissError(error: unknown) {
  if (!(error instanceof NamThanhApiError)) return false;
  const text = `${error.message} ${JSON.stringify(error.details || {})}`.toLowerCase();
  // Original 3 pattern chính
  if (text.includes('search not found or expired')) return true;
  if (text.includes('flight not found in search cache')) return true;
  if (text.includes('fare not found in search cache')) return true;
  // Mở rộng: các biến thể message từ Nam Thanh / airline khác nhau
  if (text.includes('session time out')) return true;     // VN BSP timeout
  if (text.includes('session timeout')) return true;
  if (text.includes('session expired')) return true;
  if (text.includes('searchid')) return true;             // bất kỳ message nào liên quan searchId
  if (text.includes('search cache')) return true;
  if (text.includes('cache miss')) return true;
  if (text.includes('phiên đã hết hạn')) return true;     // tiếng Việt
  if (text.includes('phien het han')) return true;
  // 5xx upstream từ airline → cũng nên thử path đầy đủ vì có thể hãng đang flaky
  if (error.status >= 500 && error.status < 600) return true;
  return false;
}

function plainVietnameseText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function namThanhErrorSearchText(error: NamThanhApiError): string {
  return `${error.message} ${JSON.stringify(error.details || {})}`.toLowerCase();
}

export function isOptionalAncillaryUnavailable(error: unknown): boolean {
  if (!(error instanceof NamThanhApiError)) return false;

  const text = namThanhErrorSearchText(error);
  const asciiText = plainVietnameseText(text);
  const ancillaryCacheMiss =
    text.includes('search not found or expired') ||
    text.includes('flight not found in search cache') ||
    text.includes('fare not found in search cache') ||
    text.includes('search cache') ||
    text.includes('cache miss');

  return (
    ancillaryCacheMiss ||
    asciiText.includes('khong lay duoc dich vu ancillary') ||
    asciiText.includes('khong co dich vu ancillary') ||
    asciiText.includes('ancillary voi hanh trinh nay') ||
    (text.includes('muadiapierror') && text.includes('status') && text.includes('200'))
  );
}

function emptyAncillaryUnavailableResponse(message?: string): BookingAncillaryResponse {
  return {
    success: true,
    warning: 'ANCILLARY_UNAVAILABLE',
    message: message || 'Hãng này hiện chưa trả dữ liệu hành lý ký gửi. Bạn vẫn có thể giữ chỗ không kèm hành lý.',
    routes: [],
  };
}

function oneWayRoutePayloadFromFlight(flight: FlightResult, body: HoldBookingRequest, idempotencyKey?: string) {
  const passengers = keepServicesForFlight(body.passengers, flight);
  return {
    from: flight.departure?.airport || body.search?.from || '',
    to: flight.arrival?.airport || body.search?.to || '',
    date: flightDate(flight) || body.search?.date || '',
    airline: flight.airlineCode || undefined,
    flightNumber: flight.flightNumber || undefined,
    time: flightTime(flight) || undefined,
    adults: body.adults ?? 1,
    children: body.children ?? 0,
    infants: body.infants ?? 0,
    cabin: body.cabin || 'economy',
    passenger: body.passenger,
    passengers,
    contact: body.contact,
    dryRun: body.dryRun,
    fastHold: body.fastHold,
    skipPricingSync: body.skipPricingSync,
    idempotencyKey,
  };
}

function roundtripHoldPayload(body: HoldBookingRequest, idempotencyKey?: string) {
  const outbound = body.outbound || body.flight;
  const inbound = body.inbound;
  const search = body.search || {
    from: outbound?.departure.airport || '',
    to: outbound?.arrival.airport || '',
    date: flightDate(outbound),
    returnDate: flightDate(inbound),
  };

  return {
    from: search.from || outbound?.departure.airport,
    to: search.to || outbound?.arrival.airport,
    date: search.date || flightDate(outbound),
    returnDate: search.returnDate || flightDate(inbound),
    airline: outbound?.airlineCode,
    flightNumber: outbound?.flightNumber,
    time: flightTime(outbound),
    returnAirline: inbound?.airlineCode,
    returnFlightNumber: inbound?.flightNumber,
    returnTime: flightTime(inbound),
    adults: body.adults ?? 1,
    children: body.children ?? 0,
    infants: body.infants ?? 0,
    cabin: body.cabin || 'economy',
    passenger: body.passenger,
    passengers: body.passengers,
    contact: body.contact,
    dryRun: body.dryRun,
    fastHold: body.fastHold,
    skipPricingSync: body.skipPricingSync,
    idempotencyKey,
  };
}

function cachedHoldPayload(flight: FlightResult, body: HoldBookingRequest, idempotencyKey?: string) {
  const passengers = keepServicesForFlight(body.passengers, flight);
  return {
    ...body,
    tripType: 'oneway',
    inbound: undefined,
    outbound: undefined,
    search: undefined,
    flight,
    searchId: flight.searchId,
    flightId: flight.id || flight.namthanh?.flightId,
    fareId: flight.fareId || flight.namthanh?.fareId,
    passengers,
    idempotencyKey,
  };
}

function responseTotal(response: HoldBookingResponse) {
  if (typeof response.totalAmount !== 'number') return undefined;
  const value = Number(response.totalAmount);
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

function mergePricingSource(outbound?: string, inbound?: string) {
  if (outbound && inbound && outbound !== inbound) return `${outbound}+${inbound}`;
  return outbound || inbound || undefined;
}

function parseSyncMs(value?: string) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function mergeSplitRoundtripPricing(
  outbound?: HoldBookingPricing,
  inbound?: HoldBookingPricing
): HoldBookingPricing | undefined {
  if (!outbound && !inbound) return undefined;

  const byPnr = [...(outbound?.byPnr || []), ...(inbound?.byPnr || [])];
  const unresolvedPnrs = Array.from(new Set([
    ...(outbound?.unresolvedPnrs || []),
    ...(inbound?.unresolvedPnrs || []),
  ].filter(Boolean)));
  const verified = outbound?.verified === true && inbound?.verified === true;
  const outboundTotal = Number(outbound?.totalAmount);
  const inboundTotal = Number(inbound?.totalAmount);
  const hasLegTotals = Number.isFinite(outboundTotal) && Number.isFinite(inboundTotal);
  const messages = [outbound?.message, inbound?.message]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const latestSyncMs = Math.max(parseSyncMs(outbound?.syncedAt), parseSyncMs(inbound?.syncedAt));

  return {
    verified,
    source: mergePricingSource(outbound?.source, inbound?.source),
    currency: outbound?.currency || inbound?.currency,
    totalAmount: verified && hasLegTotals ? Math.round(outboundTotal + inboundTotal) : undefined,
    byPnr,
    unresolvedPnrs,
    syncedAt: latestSyncMs ? new Date(latestSyncMs).toISOString() : outbound?.syncedAt || inbound?.syncedAt,
    message: verified
      ? undefined
      : (messages.join(' | ') || 'Pricing sync has not completed for all PNR(s).'),
  };
}

function mergeSplitRoundtripHold(
  outbound: HoldBookingResponse,
  inbound: HoldBookingResponse
): HoldBookingResponse {
  const pnrs = [...(outbound.pnrs || []), ...(inbound.pnrs || [])];
  const outboundTotal = responseTotal(outbound);
  const inboundTotal = responseTotal(inbound);
  const mergedPricing = mergeSplitRoundtripPricing(outbound.pricing, inbound.pricing);
  const totalAmount = outboundTotal !== undefined && inboundTotal !== undefined
    ? outboundTotal + inboundTotal
    : null;

  return {
    success: outbound.success !== false && inbound.success !== false,
    holdId: [outbound.holdId, inbound.holdId].filter(Boolean).join('+') || undefined,
    dryRun: !!outbound.dryRun && !!inbound.dryRun,
    splitRoundtrip: true,
    sessionID: outbound.sessionID,
    passenger: outbound.passenger || inbound.passenger,
    totalAmount,
    currency: mergedPricing?.currency || outbound.currency || inbound.currency,
    pricing: mergedPricing,
    protectionVerified: !!outbound.protectionVerified || !!inbound.protectionVerified,
    pnrs,
    legs: { outbound, inbound },
  };
}

async function postHold(payload: Record<string, unknown>, idempotencyKey?: string) {
  return namThanhFetch<HoldBookingResponse>('/bookings/hold', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify(payload),
  }, 300_000);
}

export interface NamThanhBookingStatusResponse {
  success: boolean;
  sessionID?: number | string;
  pnrs?: NonNullable<HoldBookingResponse['pnrs']>;
  rawStatus?: string;
}

export async function getNamThanhBookingStatus(sessionID: number | string): Promise<NamThanhBookingStatusResponse> {
  return namThanhFetch<NamThanhBookingStatusResponse>(
    `/bookings/${encodeURIComponent(String(sessionID))}`,
    { method: 'GET' },
    60_000,
  );
}

async function postAncillaries(payload: Record<string, unknown>) {
  return namThanhFetch<BookingAncillaryResponse>('/bookings/ancillaries', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 180_000);
}

async function postAncillariesForFlight(body: HoldBookingRequest, flight: FlightResult) {
  const routePayload = oneWayRoutePayloadFromFlight(flight, body);
  if (!hasCachedSelection(flight)) {
    return postAncillaries(routePayload);
  }

  try {
    return await postAncillaries(cachedHoldPayload(flight, body));
  } catch (error) {
    // Bất kỳ lỗi nào ở path cached (4xx semantic, 5xx, timeout, cache miss...)
    // → THỬ LẠI bằng path đầy đủ trước khi quăng cho UI.
    // Trade-off: thêm 1 round-trip nếu cả 2 path cùng fail, nhưng giảm tỷ lệ user thấy lỗi.
    // Riêng các lỗi "fail-fast" (auth, validation) thì path đầy đủ cũng fail nên không tốn nhiều.
    if (
      isSearchCacheMissError(error)        // Match pattern cache miss đã biết
      || isVietjetFlight(flight)           // VJ luôn fallback (legacy behavior)
      || (error instanceof NamThanhApiError && error.status !== 401 && error.status !== 403)
      // ↑ Bất kỳ lỗi không phải auth → cho cơ hội retry path đầy đủ
    ) {
      try {
        return await postAncillaries(routePayload);
      } catch (fallbackError) {
        // Path đầy đủ cũng fail → quăng lỗi gốc của path nhanh để giữ message gốc
        throw error;
      }
    }
    throw error;
  }
}

async function postHoldForFlight(body: HoldBookingRequest, flight: FlightResult, idempotencyKey?: string) {
  if (!hasCachedSelection(flight)) {
    return postHold(oneWayRoutePayloadFromFlight(flight, body, idempotencyKey), idempotencyKey);
  }

  try {
    return await postHold(cachedHoldPayload(flight, body, idempotencyKey), idempotencyKey);
  } catch (error) {
    if (!isSearchCacheMissError(error)) throw error;
    return postHold(oneWayRoutePayloadFromFlight(flight, body, idempotencyKey), idempotencyKey);
  }
}

// Lỗi cần retry inbound: timeout/5xx upstream/cache miss/session timeout
function isRetryableHoldError(error: unknown): boolean {
  if (!(error instanceof NamThanhApiError)) return false;
  if (error.status === 0 || error.status === 408 || error.status === 429) return true;
  if (error.status >= 500 && error.status < 600) return true;
  const text = `${error.message} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return (
    text.includes('upstream') ||
    text.includes('timeout') ||
    text.includes('time out') ||
    text.includes('temporarily unavailable') ||
    text.includes('econnreset') ||
    text.includes('etimedout')
  );
}

async function postHoldForFlightWithRetry(
  body: HoldBookingRequest,
  flight: FlightResult,
  idempotencyKey?: string,
  maxAttempts = 3,
): Promise<HoldBookingResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await postHoldForFlight(body, flight, idempotencyKey);
    } catch (error) {
      lastError = error;
      if (!isRetryableHoldError(error) || attempt === maxAttempts - 1) throw error;
      // 1s → 2s → 4s
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Hold failed without error info');
}

async function postHoldPayloadWithRetry(
  payload: Record<string, unknown>,
  idempotencyKey?: string,
  maxAttempts = 3,
): Promise<HoldBookingResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await postHold(payload, idempotencyKey);
    } catch (error) {
      lastError = error;
      if (!isRetryableHoldError(error) || attempt === maxAttempts - 1) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Hold failed without error info');
}

// Best-effort cancel PNR — không throw nếu fail (chỉ log) vì user đã thấy lỗi rồi.
// Nam Thanh backend có thể có hoặc chưa có endpoint /bookings/cancel.
// Khi backend chưa hỗ trợ → endpoint trả 404, ta chấp nhận và để admin xử lý thủ công.
async function tryCancelOrphanPnr(pnr: string, airline?: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pnr) return { ok: false, reason: 'no-pnr' };
  try {
    await namThanhFetch<unknown>('/bookings/cancel', {
      method: 'POST',
      body: JSON.stringify({ pnr, airline }),
    }, 30_000);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Log nhưng không throw - vì đây là cleanup best-effort
    console.error('[orphan-pnr-cancel-failed]', { pnr, airline, reason });
    return { ok: false, reason };
  }
}

async function holdSplitRoundtripBooking(body: HoldBookingRequest, idempotencyKey?: string): Promise<HoldBookingResponse> {
  const outbound = body.outbound || body.flight;
  const inbound = body.inbound;
  if (!outbound || !inbound) {
    throw new NamThanhApiError('Missing outbound/inbound flight for split roundtrip hold.', 400);
  }

  const outboundKey = idempotencyKey ? `${idempotencyKey}-OUT` : undefined;
  const inboundKey = idempotencyKey ? `${idempotencyKey}-IN` : undefined;
  let outboundResult: HoldBookingResponse | null = null;

  try {
    // Outbound cũng retry để tránh fail vì transient error
    outboundResult = await postHoldForFlightWithRetry(body, outbound, outboundKey);
  } catch (error) {
    const status = error instanceof NamThanhApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof NamThanhApiError ? error.details : undefined;
    throw new NamThanhApiError(
      `Không giữ chỗ được chiều đi: ${message}`,
      status,
      { splitRoundtrip: true, failedLeg: 'outbound', original: details }
    );
  }

  try {
    // Inbound retry với backoff — đây là điểm fail phổ biến nhất (VN BSP timeout)
    const inboundResult = await postHoldForFlightWithRetry(body, inbound, inboundKey);
    return mergeSplitRoundtripHold(outboundResult, inboundResult);
  } catch (error) {
    const status = error instanceof NamThanhApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof NamThanhApiError ? error.details : undefined;
    const orphanPnrs = (outboundResult?.pnrs || []).map((p) => ({
      airline: p.airline,
      pnr: p.pnr,
      status: p.status,
      timelimit: p.timelimit,
      from: p.from,
      to: p.to,
    }));

    // Best-effort rollback: thử cancel từng PNR outbound (chỉ cancel PNR có giá trị)
    const cancelAttempts = await Promise.all(
      orphanPnrs.map((p) => tryCancelOrphanPnr(p.pnr || '', p.airline))
    );
    const cancelledCount = cancelAttempts.filter((r) => r.ok).length;
    const allCancelled = cancelledCount === orphanPnrs.length && orphanPnrs.length > 0;

    const cancelStatus = allCancelled
      ? 'AUTO_CANCELLED'
      : cancelledCount > 0
        ? 'PARTIAL_CANCELLED'
        : 'NEEDS_MANUAL_CANCEL';

    const userMessage = allCancelled
      ? `Chiều về bị lỗi: ${message}. Hệ thống đã tự huỷ PNR chiều đi đã tạo, anh/chị có thể thử lại.`
      : `Chiều đi đã giữ chỗ thành công (PNR: ${orphanPnrs.map((p) => p.pnr).filter(Boolean).join(', ')}) nhưng chiều về bị lỗi: ${message}. Vui lòng liên hệ CSKH để huỷ PNR chiều đi nếu không tiếp tục.`;

    throw new NamThanhApiError(userMessage, status, {
      splitRoundtrip: true,
      failedLeg: 'inbound',
      completedLeg: 'outbound',
      outbound: outboundResult,
      orphanPnrs,
      orphanCancelStatus: cancelStatus,
      orphanCancelAttempts: cancelAttempts.map((r, i) => ({
        pnr: orphanPnrs[i]?.pnr,
        airline: orphanPnrs[i]?.airline,
        ok: r.ok,
        reason: r.reason,
      })),
      original: details,
    });
  }
}

export async function healthNamThanhBackend() {
  return namThanhFetch<Record<string, unknown>>('/health', { method: 'GET' }, 15_000);
}

export async function searchNamThanhFlights(payload: SearchPayload): Promise<SearchResponse> {
  const started = Date.now();
  const [data, rate] = await Promise.all([
    namThanhFetch<SearchResponse>('/flights/search', {
      method: 'POST',
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        date: payload.date,
        returnDate: payload.returnDate,
        tripType: payload.tripType,
        adults: payload.adults,
        children: payload.children,
        infants: payload.infants,
        cabin: payload.cabin,
      }),
    }),
    getVndUsdRate(),
  ]);

  const allResults = (data.results || [])
    .map((flight) => normalizeFlight(flight, data.searchId, rate))
    .filter(isFlightBookable)
    .filter((flight) => flight.price.amount > 0)
    .sort((a, b) => a.price.amount - b.price.amount);
  const allDepartureResults = (data.departureResults || [])
    .map((flight) => normalizeFlight(flight, data.searchId, rate))
    .filter(isFlightBookable)
    .filter((flight) => flight.price.amount > 0)
    .sort((a, b) => a.price.amount - b.price.amount);
  const allReturnResults = (data.returnResults || [])
    .map((flight) => normalizeFlight(flight, data.searchId, rate))
    .filter(isFlightBookable)
    .filter((flight) => flight.price.amount > 0)
    .sort((a, b) => a.price.amount - b.price.amount);
  const allPairOptions = (data.pairOptions || [])
    .map((pair) => normalizePairOption(pair, data.searchId, rate))
    .filter(isPairOptionBookable)
    .filter((pair) => pair.totalAmount > 0)
    .sort((a, b) => a.totalAmount - b.totalAmount);

  const results = trimFlightsForSearch(allResults);
  const departureResults = trimFlightsForSearch(allDepartureResults);
  const returnResults = trimFlightsForSearch(allReturnResults);
  const pairOptions = trimPairsForSearch(allPairOptions);
  const oneWayDepartureCount = payload.tripType === 'oneway' ? allResults.length : 0;
  const oneWayDisplayedDepartureCount = payload.tripType === 'oneway' ? results.length : 0;
  const totalBookableResults = allPairOptions.length || allResults.length || (allDepartureResults.length + allReturnResults.length);

  return {
    searchId: data.searchId,
    results,
    departureResults,
    returnResults,
    pairOptions,
    metadata: {
      totalResults: totalBookableResults,
      departureCount: allDepartureResults.length || oneWayDepartureCount,
      returnCount: allReturnResults.length,
      pairCount: allPairOptions.length,
      displayedResultCount: results.length,
      displayedDepartureCount: departureResults.length || oneWayDisplayedDepartureCount,
      displayedReturnCount: returnResults.length,
      displayedPairCount: pairOptions.length,
      journeyType: data.metadata?.journeyType,
      searchTime: data.metadata?.searchTime ?? Number(((Date.now() - started) / 1000).toFixed(2)),
      cached: data.metadata?.cached || false,
      sourceUsed: 'namthanh',
      engine: data.metadata?.engine || 'MuadiDirect',
      sessionID: data.metadata?.sessionID,
      expiresAt: data.metadata?.expiresAt,
      airlineErrors: data.metadata?.airlineErrors,
    },
  };
}

// ─── Streaming search (SSE) ──────────────────────────────────────────────────

export interface StreamSearchEvent {
  type: 'session' | 'airline_result' | 'airline_error' | 'done'
  airline?: string
  searchId?: string
  results?: FlightResult[]
  departureResults?: FlightResult[]
  returnResults?: FlightResult[]
  pairOptions?: RoundtripPairOption[]
  completedCount?: number
  totalCount?: number
  airlines?: string[]
  error?: string
}

export async function* streamNamThanhSearch(
  payload: SearchPayload,
  timeoutMs = 55_000,
): AsyncGenerator<StreamSearchEvent> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${backendUrl()}/flights/search/stream`, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        date: payload.date,
        returnDate: payload.returnDate,
        tripType: payload.tripType,
        adults: payload.adults,
        children: payload.children,
        infants: payload.infants,
        cabin: payload.cabin,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!res.ok || !res.body) {
      throw new NamThanhApiError(
        `Nam Thanh stream error ${res.status}`,
        res.status,
      )
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const dataLine = block.split('\n').find((l) => l.startsWith('data:'))
        if (!dataLine) continue
        const raw = dataLine.slice(5).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw) as StreamSearchEvent
          yield event
        } catch {
          // skip malformed events
        }
      }
    }
  } catch (err) {
    if (err instanceof NamThanhApiError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NamThanhApiError('Nam Thanh stream timeout', 504)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function priceNamThanhFlight(body: {
  searchId?: string;
  flightId?: string;
  fareId?: string;
  from?: string;
  to?: string;
  date?: string;
  airline?: string;
  flightNumber?: string;
  time?: string;
  cabin?: string;
  adults?: number;
  children?: number;
  infants?: number;
}) {
  const [data, rate] = await Promise.all([
    namThanhFetch<{
      success: boolean;
      searchId: string;
      flightId: string;
      fareId: string;
      flight: FlightResult;
      fareBreakdown: NonNullable<FlightResult['fareBreakdown']>;
      summary?: unknown;
    }>('/flights/price', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getVndUsdRate(),
  ]);

  return {
    ...data,
    flight: normalizeFlight(data.flight, data.searchId, rate),
  };
}

function mergeAncillaryResponse(base: Record<string, unknown>): BookingAncillaryResponse {
  const routes = Array.isArray(base.routes) ? base.routes : [];
  const outbound = base.legs && typeof base.legs === 'object' ? (base.legs as Record<string, unknown>).outbound : undefined;
  const inbound = base.legs && typeof base.legs === 'object' ? (base.legs as Record<string, unknown>).inbound : undefined;
  const outboundRoutes = outbound && typeof outbound === 'object' && Array.isArray((outbound as Record<string, unknown>).routes)
    ? ((outbound as Record<string, unknown>).routes as BookingAncillaryResponse['routes'])
    : [];
  const inboundRoutes = inbound && typeof inbound === 'object' && Array.isArray((inbound as Record<string, unknown>).routes)
    ? ((inbound as Record<string, unknown>).routes as BookingAncillaryResponse['routes'])
    : [];

  return {
    success: true,
    routes: [...routes, ...outboundRoutes, ...inboundRoutes],
  };
}

export async function listNamThanhAncillaries(
  body: HoldBookingRequest & {
    outbound?: FlightResult;
    inbound?: FlightResult;
    tripType?: 'oneway' | 'roundtrip';
  }
): Promise<BookingAncillaryResponse> {
  const isRoundtrip = body.tripType === 'roundtrip' && !!(body.outbound || body.flight) && !!body.inbound;
  const outbound = body.outbound || body.flight;
  const inbound = body.inbound;
  const shouldSplitRoundtrip = isRoundtrip &&
    !!outbound &&
    !!inbound &&
    String(outbound.airlineCode || '').toUpperCase() !== String(inbound.airlineCode || '').toUpperCase();

  if (shouldSplitRoundtrip && outbound && inbound) {
    const [outboundData, inboundData] = await Promise.allSettled([
      postAncillariesForFlight(body, outbound),
      postAncillariesForFlight(body, inbound),
    ]);
    const failures = [outboundData, inboundData].filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    const hardFailure = failures.find((result) => !isOptionalAncillaryUnavailable(result.reason));

    if (hardFailure) {
      throw hardFailure.reason;
    }

    const routes = [
      ...(outboundData.status === 'fulfilled' ? outboundData.value.routes || [] : []),
      ...(inboundData.status === 'fulfilled' ? inboundData.value.routes || [] : []),
    ];

    return {
      success: true,
      warning: failures.length > 0 ? 'ANCILLARY_PARTIAL_UNAVAILABLE' : undefined,
      message: failures.length > 0
        ? 'Một số hãng hiện chưa trả dữ liệu hành lý ký gửi. Bạn vẫn có thể giữ chỗ không kèm hành lý cho chặng đó.'
        : undefined,
      routes,
    };
  }

  if (!isRoundtrip && outbound) {
    try {
      const result = await postAncillariesForFlight(body, outbound);
      return mergeAncillaryResponse(result as unknown as Record<string, unknown>);
    } catch (error) {
      if (isOptionalAncillaryUnavailable(error)) {
        return emptyAncillaryUnavailableResponse();
      }

      throw error;
    }
  }

  const payload = isRoundtrip
    ? {
      ...roundtripHoldPayload(body),
      outbound,
      inbound,
      tripType: 'roundtrip',
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      infants: body.infants ?? 0,
      passengers: body.passengers,
      contact: body.contact,
      cabin: body.cabin || 'economy',
    }
    : {
      ...body,
      searchId: body.searchId || outbound?.searchId,
      flightId: body.flightId || outbound?.id || outbound?.namthanh?.flightId,
      fareId: body.fareId || outbound?.fareId || outbound?.namthanh?.fareId,
      passengers: keepServicesForFlight(body.passengers, outbound),
    };
  try {
    const result = await postAncillaries(payload);
    return mergeAncillaryResponse(result as unknown as Record<string, unknown>);
  } catch (error) {
    if (isOptionalAncillaryUnavailable(error)) {
      return emptyAncillaryUnavailableResponse();
    }

    throw error;
  }
}

export async function holdNamThanhBooking(
  body: HoldBookingRequest,
  idempotencyKey?: string
): Promise<HoldBookingResponse> {
  const flight = body.flight;
  const isRoundtrip = body.tripType === 'roundtrip' && !!(body.outbound || body.flight) && !!body.inbound;
  const outbound = body.outbound || body.flight;
  const inbound = body.inbound;
  const shouldSplitRoundtrip = isRoundtrip &&
    !!outbound &&
    !!inbound &&
    String(outbound.airlineCode || '').toUpperCase() !== String(inbound.airlineCode || '').toUpperCase();

  if (shouldSplitRoundtrip) {
    return holdSplitRoundtripBooking(body, idempotencyKey || body.idempotencyKey);
  }

  if (!isRoundtrip && flight) {
    return postHoldForFlightWithRetry(body, flight, idempotencyKey);
  }

  const payload = isRoundtrip
    ? roundtripHoldPayload(body, idempotencyKey || body.idempotencyKey)
    : {
      ...body,
      searchId: body.searchId || flight?.searchId,
      flightId: body.flightId || flight?.id || flight?.namthanh?.flightId,
      fareId: body.fareId || flight?.fareId || flight?.namthanh?.fareId,
      passengers: keepServicesForFlight(body.passengers, flight),
    };

  return postHoldPayloadWithRetry(payload, idempotencyKey);
}
