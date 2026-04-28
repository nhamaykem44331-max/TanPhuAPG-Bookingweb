import { NextResponse } from 'next/server';
import type { AirportRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_URL = 'http://localhost:3100';

function backendUrl(): string {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${backendUrl()}/airports`, {
      method: 'GET',
      headers: backendHeaders(),
      cache: 'no-store',
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    const airports = Array.isArray(data?.airports) ? data.airports : [];
    const version = Number(data?.version) || 0;

    return NextResponse.json(
      {
        airports: airports as AirportRecord[],
        version,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        airports: [] as AirportRecord[],
        version: 0,
        error: message,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
