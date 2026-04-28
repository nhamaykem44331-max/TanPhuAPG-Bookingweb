import { NextRequest, NextResponse } from 'next/server';
import { searchNamThanhFlights, NamThanhApiError } from '@/lib/namthanh';
import { getCachedVndUsdRate } from '@/lib/exchange';
import {
  loadMarkupContext,
  applyMarkupToFlights,
  applyMarkupToPairs,
} from '@/lib/pricing/searchMarkup';
import { isValidIATA, isValidDate } from '@/lib/utils';
import type { SearchPayload, SearchResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

function localTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

function validate(body: SearchPayload): string | null {
  const today = localTodayYmd();
  if (!body.from || !isValidIATA(body.from)) return 'Mã sân bay đi không hợp lệ (VD: HAN)';
  if (!body.to || !isValidIATA(body.to)) return 'Mã sân bay đến không hợp lệ (VD: SGN)';
  if (body.from === body.to) return 'Điểm đi và điểm đến không được giống nhau';
  if (!body.date || !isValidDate(body.date)) return 'Ngày đi không hợp lệ (YYYY-MM-DD)';
  if (body.date < today) return 'Ngày đi phải từ hôm nay trở đi';
  if (body.tripType === 'roundtrip' && !body.returnDate) return 'Chuyến khứ hồi phải có ngày về';
  if (body.returnDate && !isValidDate(body.returnDate)) return 'Ngày về không hợp lệ';
  if (body.returnDate && body.returnDate < today) return 'Ngày về phải từ hôm nay trở đi';
  if (body.returnDate && body.returnDate < body.date) return 'Ngày về phải sau ngày đi';
  if ((body.adults ?? 1) < 1 || (body.adults ?? 1) > 9) return 'Số người lớn phải từ 1-9';
  if ((body.children ?? 0) < 0 || (body.children ?? 0) > 9) return 'Số trẻ em phải từ 0-9';
  if ((body.infants ?? 0) < 0 || (body.infants ?? 0) > 4) return 'Số em bé phải từ 0-4';
  if ((body.infants ?? 0) > (body.adults ?? 1)) return 'Số em bé không được vượt quá số người lớn';
  if ((body.adults ?? 1) + (body.children ?? 0) + (body.infants ?? 0) > 9) return 'Tổng số hành khách tối đa 9';
  if (!['economy', 'premium', 'business', 'first'].includes(body.cabin)) return 'Hạng vé không hợp lệ';
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
      }
    );
  }

  let body: SearchPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
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
  if (validErr) return NextResponse.json({ error: validErr }, { status: 400 });

  try {
    const payload = await searchNamThanhFlights(body);

    // Apply markup ngay tại search → khách thấy giá B2C (đã cộng markup)
    // Channel 'web' → chỉ rule có channel='web' hoặc channel=null mới khớp
    // PaxType 'ADT' → rule khác paxtype không cộng cho người lớn (mặc định)
    let markupedPayload: SearchResponse = payload;
    try {
      const ctx = await loadMarkupContext('web', 'ADT');
      const exchangeRate = getCachedVndUsdRate();
      const tripType: 'ONEWAY' | 'ROUNDTRIP' = body.tripType === 'roundtrip' ? 'ROUNDTRIP' : 'ONEWAY';
      const [results, departureResults, returnResults, pairOptions] = await Promise.all([
        applyMarkupToFlights(payload.results || [], ctx, tripType, exchangeRate),
        applyMarkupToFlights(payload.departureResults || [], ctx, tripType, exchangeRate),
        applyMarkupToFlights(payload.returnResults || [], ctx, tripType, exchangeRate),
        applyMarkupToPairs(payload.pairOptions || [], ctx, exchangeRate),
      ]);
      // Sort lại theo giá đã cộng markup (markup có thể đổi thứ tự khi rule khác hãng khác giá)
      const sortByPrice = <T extends { price: { amount: number } }>(arr: T[]) =>
        arr.slice().sort((a, b) => a.price.amount - b.price.amount);
      const sortByTotal = (arr: typeof pairOptions) =>
        arr.slice().sort((a, b) => a.totalAmount - b.totalAmount);

      markupedPayload = {
        ...payload,
        results: sortByPrice(results),
        departureResults: sortByPrice(departureResults),
        returnResults: sortByPrice(returnResults),
        pairOptions: sortByTotal(pairOptions),
      };
    } catch (markupError) {
      // Fail-open: nếu markup engine lỗi (DB mất kết nối, rule corrupt) → trả giá net
      // Better than blocking entire search. Log để admin biết.
      console.error('[search/route] Markup apply failed, returning net prices:', markupError);
    }

    return NextResponse.json(markupedPayload, {
      headers: {
        'X-Engine': 'NamThanhMuadi',
        'X-Results': String(markupedPayload.metadata?.totalResults ?? markupedPayload.results.length),
        'X-Markup-Applied': markupedPayload === payload ? 'false' : 'true',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[search/route] Nam Thanh error:', msg);
    const partnerAirportUnsupported =
      error instanceof NamThanhApiError &&
      /validation request failed|unknown airport|origin|destination|route not support|route unsupported|airport not support/i.test(msg);

    return NextResponse.json({
      error: partnerAirportUnsupported
        ? `Sân bay ${body.from} hoặc ${body.to} không được hỗ trợ bởi đối tác.`
        : 'Lỗi tìm chuyến bay từ Nam Thanh backend. Vui lòng kiểm tra namthanh-auto-login localhost.',
      details: process.env.NODE_ENV === 'development' || error instanceof NamThanhApiError ? msg : undefined,
    }, { status: error instanceof NamThanhApiError ? Math.min(Math.max(error.status, 400), 599) : 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: 'NamThanhMuadi',
    backend: process.env.NAMTHANH_BACKEND_URL || 'http://localhost:3100',
    timestamp: new Date().toISOString(),
  });
}
