/**
 * POST /api/n8n/search
 * Search flights through the local Nam Thanh backend.
 * Header: x-api-key: YOUR_SECRET_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchNamThanhFlights } from '@/lib/namthanh';
import { getVndUsdRate } from '@/lib/exchange';
import { isValidIATA, isValidDate } from '@/lib/utils';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';
import type { Cabin, SearchPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function fmt(n: number) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
function hhmm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const from = String(body.from || '').toUpperCase();
  const to = String(body.to || '').toUpperCase();
  const date = String(body.date || '');
  const adults = Number(body.adults ?? 1);
  const children = Number(body.children ?? 0);
  const infants = Number(body.infants ?? 0);
  const cabin = String(body.cabin || 'economy') as Cabin;
  const limit = Math.min(Number(body.limit ?? 10), 20);
  const sortBy = String(body.sortBy || 'price');
  const airlinesOnly = Array.isArray(body.airlinesOnly) ? body.airlinesOnly.map(String) : [];

  if (!isValidIATA(from)) return NextResponse.json({ error: 'Mã sân bay "from" không hợp lệ' }, { status: 400 });
  if (!isValidIATA(to)) return NextResponse.json({ error: 'Mã sân bay "to" không hợp lệ' }, { status: 400 });
  if (from === to) return NextResponse.json({ error: 'Điểm đi và đến không được giống nhau' }, { status: 400 });
  if (!isValidDate(date)) return NextResponse.json({ error: 'Ngày không hợp lệ (YYYY-MM-DD)' }, { status: 400 });

  const started = Date.now();
  try {
    const payload: SearchPayload = { from, to, date, adults, children, infants, cabin, tripType: 'oneway' };
    const [data, rate] = await Promise.all([searchNamThanhFlights(payload), getVndUsdRate()]);

    let flights = (data.results || []).map((f) => {
      const price = Number(f.fareBreakdown?.totalAmount ?? f.price.amount ?? 0);
      return {
        id: f.id,
        searchId: f.searchId || data.searchId,
        fareId: f.fareId,
        airline: f.airline,
        airlineCode: f.airlineCode,
        airlineLogo: f.airlineLogo,
        flightNumber: f.flightNumber,
        from: f.departure.airport,
        fromCity: f.departure.city,
        to: f.arrival.airport,
        toCity: f.arrival.city,
        departureTime: f.departure.time,
        arrivalTime: f.arrival.time,
        durationMinutes: f.duration,
        stops: f.stops,
        price,
        priceUSD: Math.round(price / rate),
        fareBreakdown: f.fareBreakdown,
        detailUrl: f.detailUrl || null,
        summary: `${f.flightNumber} | ${hhmm(f.departure.time)} → ${hhmm(f.arrival.time)} | ${fmt(price)}`,
      };
    });

    if (airlinesOnly.length > 0) {
      flights = flights.filter((f) => airlinesOnly.includes(f.airlineCode));
    }

    if (sortBy === 'time') flights.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    else flights.sort((a, b) => a.price - b.price);

    const limited = flights.slice(0, limit);

    return NextResponse.json({
      success: true,
      route: `${from} → ${to}`,
      date,
      passengers: { adults, children, infants },
      totalFound: flights.length,
      returned: limited.length,
      cheapest: limited[0] || null,
      flights: limited,
      searchId: data.searchId,
      metadata: data.metadata,
      searchTime: `${((Date.now() - started) / 1000).toFixed(2)}s`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
