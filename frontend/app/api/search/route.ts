import { NextRequest, NextResponse } from 'next/server';
import { searchNamThanhFlights, NamThanhApiError } from '@/lib/namthanh';
import { getCachedVndUsdRate } from '@/lib/exchange';
import {
  loadMarkupContext,
  applyMarkupToFlights,
  applyMarkupToPairs,
} from '@/lib/pricing/searchMarkup';
import type { SearchPayload, SearchResponse } from '@/lib/types';
import { checkSearchRateLimit, normalizeSearchPayload, searchClientIp, validateSearchPayload } from '@/lib/search/requestGuard';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rateLimit = checkSearchRateLimit(searchClientIp(req));
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Window': String(rateLimit.windowSeconds),
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

  body = normalizeSearchPayload(body);

  const validErr = validateSearchPayload(body);
  if (validErr) return NextResponse.json({ error: validErr }, { status: 400 });

  try {
    const payload = await searchNamThanhFlights(body);

    // Apply markup ngay tại search → khách thấy giá B2C (đã cộng markup)
    // Channel 'web' → chỉ rule có channel='web' hoặc channel=null mới khớp
    // PaxType 'ADT' → rule khác paxtype không cộng cho người lớn (mặc định)
    let markupedPayload: SearchResponse;
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
      console.error('[search/route] Markup unavailable; refusing to expose net prices:', markupError);
      return NextResponse.json(
        { error: 'Hệ thống giá tạm thời chưa sẵn sàng. Vui lòng thử lại sau.' },
        { status: 503 },
      );
    }

    return NextResponse.json(markupedPayload, {
      headers: {
        'X-Engine': 'NamThanhMuadi',
        'X-Results': String(markupedPayload.metadata?.totalResults ?? markupedPayload.results.length),
        'X-Markup-Applied': 'true',
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
        : 'Không tìm được chuyến bay lúc này. Vui lòng thử lại sau ít phút.',
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
