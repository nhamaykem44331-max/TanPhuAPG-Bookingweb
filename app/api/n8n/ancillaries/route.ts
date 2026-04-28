import { NextRequest, NextResponse } from 'next/server';
import { listNamThanhAncillaries, NamThanhApiError } from '@/lib/namthanh';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';
import type { HoldBookingRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 180;

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function backendDetailText(details: unknown) {
  const data = recordOf(details);
  const nested = recordOf(data.details);
  const parts = [
    data.type ? `type ${String(data.type)}` : '',
    data.status ? `status ${String(data.status)}` : '',
    data.path ? `path ${String(data.path)}` : '',
    nested.code ? `code ${String(nested.code)}` : '',
    nested.message ? `message ${String(nested.message)}` : '',
    data.otpRequired ? 'otpRequired true' : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: HoldBookingRequest & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const outbound = body.outbound || body.flight;
  const inbound = body.inbound;
  const searchId = String(body.searchId || outbound?.searchId || '');
  const flightId = String(body.flightId || outbound?.id || outbound?.namthanh?.flightId || '');
  const fareId = body.fareId || outbound?.fareId || outbound?.namthanh?.fareId;
  const isRoundtrip = body.tripType === 'roundtrip' && !!outbound && !!inbound;

  if (!isRoundtrip && (!searchId || !flightId) && !(body.from && body.to && body.date)) {
    return NextResponse.json({ error: 'Thiếu searchId/flightId cho ancillaries' }, { status: 400 });
  }

  try {
    const result = await listNamThanhAncillaries({
      ...body,
      flight: outbound,
      outbound,
      inbound,
      tripType: isRoundtrip ? 'roundtrip' : 'oneway',
      searchId,
      flightId,
      fareId,
      adults: Number(body.adults ?? 1),
      children: Number(body.children ?? 0),
      infants: Number(body.infants ?? 0),
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof NamThanhApiError) {
      const details = backendDetailText(e.details);
      const msg = details ? `${e.message} (${details})` : e.message;
      return NextResponse.json({
        success: false,
        error: msg,
        details: e.details,
      }, { status: e.status || 500 });
    }

    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
