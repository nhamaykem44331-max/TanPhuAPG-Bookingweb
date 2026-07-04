import { NextRequest, NextResponse } from 'next/server';
import { priceNamThanhFlight } from '@/lib/namthanh';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const searchId = String(body?.searchId || '');
    const flightId = String(body?.flightId || body?.id || '');
    const fareId = body?.fareId ? String(body.fareId) : undefined;

    if (!searchId || !flightId) {
      return NextResponse.json({
        error: 'Nam Thanh fare detail cần đúng searchId và flightId. Search mới đã trả sẵn fareBreakdown nên thường không cần gọi endpoint này.',
      }, { status: 400 });
    }

    const detail = await priceNamThanhFlight({ searchId, flightId, fareId });
    return NextResponse.json({
      fareBreakdown: detail.fareBreakdown,
      flight: detail.flight,
      searchId: detail.searchId,
      flightId: detail.flightId,
      fareId: detail.fareId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Lỗi fare detail Nam Thanh' }, { status: 500 });
  }
}
