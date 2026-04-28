/**
 * GET /api/exchange-rate
 * Public endpoint returning the current VND/USD rate (read from the backend, with cache/fallback).
 * Used by client components (e.g. quote page) so they don't hardcode a rate.
 */
import { NextResponse } from 'next/server';
import { getVndUsdRate } from '@/lib/exchange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rate = await getVndUsdRate();
  return NextResponse.json({ rate }, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
