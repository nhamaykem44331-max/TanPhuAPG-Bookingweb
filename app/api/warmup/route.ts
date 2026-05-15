/**
 * GET /api/warmup
 * Client-side fallback warmup. The homepage also starts this from the server
 * render path, so the first search does not pay the cold login cost.
 */
import { NextResponse } from 'next/server';
import { ensureNamThanhSession } from '@/lib/namthanh-warmup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await ensureNamThanhSession({ timeoutMs: 5000 });
  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
