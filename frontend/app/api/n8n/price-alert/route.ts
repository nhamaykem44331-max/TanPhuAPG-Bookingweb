/**
 * POST /api/n8n/price-alert
 * Scan routes through the local Nam Thanh backend and alert on full fare.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchNamThanhFlights } from '@/lib/namthanh';
import { isValidIATA, isValidDate } from '@/lib/utils';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { triggerMatchingPriceAlerts, type TriggeredPriceAlert } from '@/lib/price-alerts/admin';
import type { Cabin, SearchPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

  const routes = Array.isArray(body.routes) ? body.routes as { from: string; to: string; date: string }[] : [];
  const adults = Number(body.adults ?? 1);
  const children = Number(body.children ?? 0);
  const infants = Number(body.infants ?? 0);
  const cabin = String(body.cabin || 'economy') as Cabin;
  const thresholdVND = Number(body.thresholdVND ?? Infinity);
  const topN = Math.min(Number(body.topN ?? 3), 10);

  if (routes.length === 0) return NextResponse.json({ error: '"routes" không được rỗng' }, { status: 400 });
  if (routes.length > 5) return NextResponse.json({ error: 'Tối đa 5 tuyến mỗi lần quét' }, { status: 400 });

  for (const r of routes) {
    r.from = String(r.from || '').toUpperCase();
    r.to = String(r.to || '').toUpperCase();
    if (!isValidIATA(r.from) || !isValidIATA(r.to)) return NextResponse.json({ error: `Mã sân bay không hợp lệ: ${r.from}/${r.to}` }, { status: 400 });
    if (!isValidDate(r.date)) return NextResponse.json({ error: `Ngày không hợp lệ: ${r.date}` }, { status: 400 });
  }

  const started = Date.now();
  const results: Record<string, unknown>[] = [];
  const alerts: Record<string, unknown>[] = [];
  const triggeredPriceAlerts: TriggeredPriceAlert[] = [];

  for (const route of routes) {
    try {
      const payload: SearchPayload = {
        from: route.from,
        to: route.to,
        date: route.date,
        adults,
        children,
        infants,
        cabin,
        tripType: 'oneway',
      };
      const data = await searchNamThanhFlights(payload);
      const pricedFlights = (data.results || [])
        .filter((f) => (f.fareBreakdown?.totalAmount ?? f.price.amount) > 0)
        .sort((a, b) => (a.fareBreakdown?.totalAmount ?? a.price.amount) - (b.fareBreakdown?.totalAmount ?? b.price.amount));
      const sorted = pricedFlights
        .slice(0, topN)
        .map((f) => {
          const price = Number(f.fareBreakdown?.totalAmount ?? f.price.amount);
          return {
            route: `${route.from} → ${route.to}`,
            date: route.date,
            flightNumber: f.flightNumber,
            airline: f.airline,
            airlineCode: f.airlineCode,
            airlineLogo: f.airlineLogo,
            departure: hhmm(f.departure.time),
            arrival: hhmm(f.arrival.time),
            stops: f.stops,
            price,
            fareBreakdown: f.fareBreakdown,
            priceFormatted: fmt(price),
            belowThreshold: price <= thresholdVND,
            telegramText: `✈ *${f.flightNumber}* ${route.from}→${route.to} ${route.date}\n⏰ ${hhmm(f.departure.time)} → ${hhmm(f.arrival.time)}\n💰 *${fmt(price)}*/người\n${price <= thresholdVND ? '🔥 GIÁ RẺ!' : ''}`,
          };
        });

      for (const flight of sorted) {
        const triggered = await triggerMatchingPriceAlerts({
          route: `${route.from}-${route.to}`,
          airline: flight.airlineCode,
          price: flight.price,
          flightNumber: flight.flightNumber,
          travelDate: route.date,
        });
        triggered.forEach((alert) => triggeredPriceAlerts.push(alert));
      }

      const cheapest = sorted[0];
      results.push({
        route: `${route.from} → ${route.to}`,
        date: route.date,
        found: data.results.length,
        cheapest: cheapest || null,
        top: sorted,
        hasAlert: sorted.some((f) => f.belowThreshold),
        metadata: data.metadata,
      });

      sorted.filter((f) => f.belowThreshold).forEach((f) => alerts.push(f));
    } catch (e: unknown) {
      results.push({
        route: `${route.from} → ${route.to}`,
        date: route.date,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const telegramSummary = alerts.length > 0
    ? `🚨 *CÓ ${alerts.length} CHUYẾN GIÁ RẺ!*\nNgưỡng: ${fmt(thresholdVND)}\n\n${alerts.map((a) => a.telegramText).join('\n\n')}`
    : `✅ Quét ${routes.length} tuyến - không có chuyến nào dưới ${fmt(thresholdVND)}`;

  return NextResponse.json({
    success: true,
    scannedRoutes: routes.length,
    alertsFound: alerts.length,
    priceAlertsTriggered: triggeredPriceAlerts.length,
    hasAlerts: alerts.length > 0,
    threshold: thresholdVND,
    telegramMessage: telegramSummary,
    alerts,
    triggeredPriceAlerts,
    results,
    scanTime: `${((Date.now() - started) / 1000).toFixed(2)}s`,
  });
}
