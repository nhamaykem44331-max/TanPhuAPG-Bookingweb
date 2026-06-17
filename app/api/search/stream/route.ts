import { type NextRequest, NextResponse } from 'next/server';
import {
  normalizeFlight,
  normalizePairOption,
  isFlightBookable,
  isPairOptionBookable,
  streamNamThanhSearch,
  NamThanhApiError,
} from '@/lib/namthanh';
import { getCachedVndUsdRate } from '@/lib/exchange';
import {
  loadMarkupContext,
  applyMarkupToFlights,
  applyMarkupToPairs,
} from '@/lib/pricing/searchMarkup';
import { isValidIATA, isValidDate } from '@/lib/utils';
import type { FlightResult, RoundtripPairOption, SearchPayload } from '@/lib/types';

export const runtime = 'nodejs';
// SSE streams — no hard timeout; stream ends when backend closes
export const maxDuration = 60;

// Rate-limit theo IP (in-memory). Dùng chung env config với /api/search để chống
// spam click mở nhiều SSE stream song song (defense-in-depth, ngoài cơ chế abort).
const rlBucket = new Map<string, { count: number; resetAt: number }>();
let rlCalls = 0;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DEFAULT_RATE_LIMIT = process.env.NODE_ENV === 'development' ? 500 : 120;
const DEFAULT_RATE_WINDOW_MS = process.env.NODE_ENV === 'development' ? 60_000 : 3_600_000;
const RATE_LIMIT_MAX = envNumber('SEARCH_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT);
const RATE_LIMIT_WINDOW_MS = envNumber('SEARCH_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_WINDOW_MS);
const RATE_LIMIT_DISABLED = process.env.SEARCH_RATE_LIMIT_DISABLED === 'true';

function checkRateLimit(ip: string): { ok: boolean; retryAfterSeconds: number } {
  if (RATE_LIMIT_DISABLED) return { ok: true, retryAfterSeconds: 0 };

  const now = Date.now();
  const entry = rlBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    rlBucket.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, retryAfterSeconds: 0 };
  }
  entry.count++;
  if (++rlCalls % 500 === 0) {
    for (const [k, v] of rlBucket) if (now > v.resetAt) rlBucket.delete(k);
  }
  return {
    ok: entry.count <= RATE_LIMIT_MAX,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function localTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function validate(body: SearchPayload): string | null {
  const today = localTodayYmd();
  if (!body.from || !isValidIATA(body.from)) return 'Mã sân bay đi không hợp lệ';
  if (!body.to || !isValidIATA(body.to)) return 'Mã sân bay đến không hợp lệ';
  if (body.from === body.to) return 'Điểm đi và điểm đến không được giống nhau';
  if (!body.date || !isValidDate(body.date)) return 'Ngày đi không hợp lệ';
  if (body.date < today) return 'Ngày đi phải từ hôm nay trở đi';
  return null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Window': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
        },
      },
    );
  }

  let body: SearchPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  body = {
    ...body,
    from: String(body.from || '').toUpperCase(),
    to: String(body.to || '').toUpperCase(),
    adults: Number(body.adults ?? 1),
    children: Number(body.children ?? 0),
    infants: Number(body.infants ?? 0),
    cabin: body.cabin || 'economy',
    tripType: body.tripType || 'oneway',
  };

  const validErr = validate(body);
  if (validErr) {
    return NextResponse.json({ error: validErr }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const tripType: 'ONEWAY' | 'ROUNDTRIP' = body.tripType === 'roundtrip' ? 'ROUNDTRIP' : 'ONEWAY';

  // Hủy fetch tới backend khi client ngắt kết nối (đổi search / đóng tab) → tránh rò rỉ handler
  // làm các search sau trả rỗng. Liên kết với req.signal (client disconnect) + cancel() bên dưới.
  const upstream = new AbortController();
  const onClientAbort = () => upstream.abort();
  if (req.signal.aborted) upstream.abort();
  else req.signal.addEventListener('abort', onClientAbort, { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      function push(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      }

      function pushError(message: string) {
        try {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        } catch {
          // already closed
        }
      }

      try {
        // Load markup context + exchange rate once — reused for all airline chunks
        const [ctx, exchangeRate] = await Promise.all([
          loadMarkupContext('web', 'ADT'),
          Promise.resolve(getCachedVndUsdRate()),
        ]);

        const fallbackSearchId = `stream_${Date.now()}`;

        for await (const event of streamNamThanhSearch(body, 55_000, upstream.signal)) {
          if (upstream.signal.aborted) break;
          if (event.type === 'session') {
            push(event);
            continue;
          }

          if (event.type === 'airline_result') {
            const searchId = event.searchId || fallbackSearchId;
            // Normalize then apply markup per-airline chunk
            const rawResults = (event.results ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            ).filter(isFlightBookable);
            const rawDeparture = (event.departureResults ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            ).filter(isFlightBookable);
            const rawReturn = (event.returnResults ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            ).filter(isFlightBookable);
            const rawPairs = (event.pairOptions ?? []).map((pair: RoundtripPairOption) =>
              normalizePairOption(pair, searchId, exchangeRate),
            ).filter(isPairOptionBookable);

            const [results, departureResults, returnResults, pairOptions] = await Promise.all([
              applyMarkupToFlights(rawResults, ctx, tripType, exchangeRate),
              applyMarkupToFlights(rawDeparture, ctx, tripType, exchangeRate),
              applyMarkupToFlights(rawReturn, ctx, tripType, exchangeRate),
              applyMarkupToPairs(rawPairs, ctx, exchangeRate),
            ]);

            push({
              type: 'airline_result',
              airline: event.airline,
              searchId,
              results: results.filter((f) => f.price.amount > 0),
              departureResults: departureResults.filter((f) => f.price.amount > 0),
              returnResults: returnResults.filter((f) => f.price.amount > 0),
              pairOptions: pairOptions
                .filter((pair) => pair.totalAmount > 0)
                .sort((a, b) => a.totalAmount - b.totalAmount),
              completedCount: event.completedCount,
              totalCount: event.totalCount,
            });
            continue;
          }

          if (event.type === 'airline_error') {
            push(event);
            continue;
          }

          if (event.type === 'done') {
            push(event);
            break;
          }
        }
      } catch (err) {
        // Client ngắt giữa chừng → kết thúc êm, không đẩy lỗi giả.
        if (upstream.signal.aborted) {
          try { controller.close(); } catch { /* already closed */ }
          return;
        }
        const msg = err instanceof NamThanhApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : String(err);
        // 404 from backend = streaming endpoint not deployed yet
        const isNotDeployed = err instanceof NamThanhApiError && err.status === 404;
        pushError(isNotDeployed ? 'STREAM_NOT_SUPPORTED' : msg);
        return;
      } finally {
        req.signal.removeEventListener('abort', onClientAbort);
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      // ReadableStream bị hủy (client đóng kết nối) → hủy fetch backend đang chạy.
      upstream.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Streaming flight search (SSE). Use POST with SearchPayload body.',
    endpoint: '/api/search/stream',
  });
}
