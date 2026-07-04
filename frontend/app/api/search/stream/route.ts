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
