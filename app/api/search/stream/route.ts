import { type NextRequest, NextResponse } from 'next/server';
import {
  normalizeFlight,
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

        const searchId = `stream_${Date.now()}`;

        for await (const event of streamNamThanhSearch(body)) {
          if (event.type === 'session') {
            push(event);
            continue;
          }

          if (event.type === 'airline_result') {
            // Normalize then apply markup per-airline chunk
            const rawResults = (event.results ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            );
            const rawDeparture = (event.departureResults ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            );
            const rawReturn = (event.returnResults ?? []).map((f: FlightResult) =>
              normalizeFlight(f, searchId, exchangeRate),
            );

            const [results, departureResults, returnResults] = await Promise.all([
              applyMarkupToFlights(rawResults, ctx, tripType, exchangeRate),
              applyMarkupToFlights(rawDeparture, ctx, tripType, exchangeRate),
              applyMarkupToFlights(rawReturn, ctx, tripType, exchangeRate),
            ]);

            push({
              type: 'airline_result',
              airline: event.airline,
              results: results.filter((f) => f.price.amount > 0),
              departureResults: departureResults.filter((f) => f.price.amount > 0),
              returnResults: returnResults.filter((f) => f.price.amount > 0),
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
        const msg = err instanceof NamThanhApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : String(err);
        // 404 from backend = streaming endpoint not deployed yet
        const isNotDeployed = err instanceof NamThanhApiError && err.status === 404;
        pushError(isNotDeployed ? 'STREAM_NOT_SUPPORTED' : msg);
        return;
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
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
