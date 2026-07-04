import { NextResponse } from 'next/server';
import type { AirportRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_URL = 'http://localhost:3100';
const POPULAR_AIRPORT_CODES = new Set([
  'HAN', 'SGN', 'DAD', 'PQC', 'CXR', 'VII', 'HPH', 'HUI', 'VCA', 'DLI', 'UIH', 'VCL', 'BMV',
  'BKK', 'DMK', 'SIN', 'KUL', 'CAN', 'SZX', 'HKG', 'TPE', 'ICN', 'NRT', 'KIX', 'PVG', 'PEK',
]);

function backendUrl(): string {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const popularOnly = url.searchParams.get('popular') === '1';
  const domesticOnly = url.searchParams.get('domestic') === '1';
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
    const airports = Array.isArray(data?.airports) ? data.airports as AirportRecord[] : [];
    const version = Number(data?.version) || 0;
    const filteredAirports = airports.filter((airport) => {
      if (popularOnly && !POPULAR_AIRPORT_CODES.has(String(airport.code || '').toUpperCase())) return false;
      if (domesticOnly && airport.domestic !== true) return false;
      return true;
    });

    return NextResponse.json(
      {
        airports: filteredAirports,
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
