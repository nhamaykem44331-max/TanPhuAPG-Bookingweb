import type {
  BookingAncillaryResponse,
  Cabin,
  FlightResult,
  TripType,
} from './types';

const ANCILLARY_CACHE_TTL_MS = 120 * 1000;

type AncillaryRequestPayload = {
  flight: FlightResult;
  outbound?: FlightResult | null;
  inbound?: FlightResult | null;
  tripType?: TripType;
  search?: {
    from: string;
    to: string;
    date: string;
    returnDate?: string;
  };
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: Cabin;
};

type AncillaryCacheEntry = {
  expiresAt: number;
  data?: BookingAncillaryResponse;
  promise?: Promise<BookingAncillaryResponse>;
};

const ancillaryCache = new Map<string, AncillaryCacheEntry>();

function toText(value: unknown) {
  return String(value || '').trim();
}

function normalizeText(value: unknown) {
  return toText(value).replace(/\s+/g, ' ').trim();
}

function uniqueParts(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const text = normalizeText(part);
    if (!text) return false;
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function flightCachePart(flight?: FlightResult | null) {
  if (!flight) return '';
  return [
    flight.searchId || '',
    flight.id || flight.namthanh?.flightId || '',
    flight.fareId || flight.namthanh?.fareId || '',
    flight.airlineCode || '',
    flight.flightNumber || '',
    flight.departure?.airport || '',
    flight.arrival?.airport || '',
    flight.departure?.time || '',
  ].join(':');
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of ancillaryCache.entries()) {
    if (!entry.promise && entry.expiresAt <= now) {
      ancillaryCache.delete(key);
    }
  }
}

function ancillaryCacheKey(payload: AncillaryRequestPayload) {
  const outbound = payload.outbound || payload.flight;
  const inbound = payload.inbound || null;
  const search = payload.search || {
    from: outbound?.departure?.airport || '',
    to: outbound?.arrival?.airport || '',
    date: '',
    returnDate: '',
  };

  return JSON.stringify({
    tripType: payload.tripType || (inbound ? 'roundtrip' : 'oneway'),
    outbound: flightCachePart(outbound),
    inbound: flightCachePart(inbound),
    search: [
      search.from || '',
      search.to || '',
      search.date || '',
      search.returnDate || '',
    ].join(':'),
    pax: [
      Number(payload.adults || 1),
      Number(payload.children || 0),
      Number(payload.infants || 0),
    ].join(':'),
    cabin: payload.cabin || 'economy',
  });
}

function ancillaryErrorText(data: unknown, statusCode?: number) {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const details = body.details && typeof body.details === 'object'
    ? (body.details as Record<string, unknown>)
    : {};
  const nested = details.details && typeof details.details === 'object'
    ? (details.details as Record<string, unknown>)
    : {};
  const topMessage = normalizeText(body.error || body.message);
  const nestedMessage = normalizeText(nested.message);
  const detailMessage = normalizeText(details.message);
  const pathText = toText(details.path);

  const parts = uniqueParts([
    topMessage,
    nestedMessage,
    detailMessage,
    statusCode ? `HTTP ${statusCode}` : '',
    pathText ? `path ${pathText}` : '',
  ]);

  return parts.join(' | ') || 'Khong lay duoc hanh ly ky gui.';
}

function cachePayloadData(data: unknown): BookingAncillaryResponse {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    success: true,
    warning: typeof body.warning === 'string' ? body.warning : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
    routes: Array.isArray(body.routes)
      ? (body.routes as BookingAncillaryResponse['routes'])
      : [],
  };
}

class AncillaryHttpError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'AncillaryHttpError';
    this.status = status;
    this.retryable = retryable;
  }
}

async function fetchAncillaryResponse(payload: AncillaryRequestPayload) {
  let res: Response;
  try {
    res = await fetch('/api/booking/ancillaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flight: payload.flight,
        outbound: payload.outbound || payload.flight,
        inbound: payload.tripType === 'roundtrip' ? payload.inbound : undefined,
        tripType: payload.tripType || (payload.inbound ? 'roundtrip' : 'oneway'),
        search: payload.search,
        adults: payload.adults,
        children: payload.children,
        infants: payload.infants,
        cabin: payload.cabin,
      }),
    });
  } catch (networkError) {
    // Lỗi mạng (offline / DNS / abort) → retryable
    throw new AncillaryHttpError(
      networkError instanceof Error ? networkError.message : 'Lỗi kết nối',
      0,
      true,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    // 4xx (trừ 408/429): client error → KHÔNG retry; 5xx + 408/429 + 0: retryable
    const retryable = res.status === 0 || res.status === 408 || res.status === 429 || res.status >= 500;
    throw new AncillaryHttpError(ancillaryErrorText(data, res.status), res.status, retryable);
  }
  return cachePayloadData(data);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchAncillaryWithRetry(payload: AncillaryRequestPayload, maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchAncillaryResponse(payload);
    } catch (error) {
      lastError = error;
      // Không retry nếu lỗi semantic / client (4xx ngoài 408, 429)
      if (error instanceof AncillaryHttpError && !error.retryable) throw error;
      if (attempt < maxAttempts - 1) {
        // 500ms → 1s → 2s
        await sleep(500 * 2 ** attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Lỗi không xác định khi tải hành lý.');
}

export function peekAncillaryResponse(payload: AncillaryRequestPayload) {
  cleanupCache();
  const key = ancillaryCacheKey(payload);
  const entry = ancillaryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now() || !entry.data) return null;
  return entry.data;
}

export async function loadAncillaryResponse(payload: AncillaryRequestPayload) {
  cleanupCache();
  const key = ancillaryCacheKey(payload);
  const existing = ancillaryCache.get(key);
  if (existing?.data && existing.expiresAt > Date.now()) {
    return existing.data;
  }
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetchAncillaryWithRetry(payload)
    .then((data) => {
      ancillaryCache.set(key, {
        data,
        expiresAt: Date.now() + ANCILLARY_CACHE_TTL_MS,
      });
      return data;
    })
    .catch((error) => {
      ancillaryCache.delete(key);
      throw error;
    });

  ancillaryCache.set(key, {
    expiresAt: Date.now() + ANCILLARY_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

export function prefetchAncillaryResponse(payload: AncillaryRequestPayload) {
  void loadAncillaryResponse(payload).catch(() => {});
}
