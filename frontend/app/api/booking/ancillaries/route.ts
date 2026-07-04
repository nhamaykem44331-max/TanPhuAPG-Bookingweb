import { NextRequest, NextResponse } from 'next/server';
import { isOptionalAncillaryUnavailable, listNamThanhAncillaries, NamThanhApiError } from '@/lib/namthanh';
import type { HoldBookingRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 180;

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueParts(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const text = normalizeText(part);
    if (!text) return false;
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function backendDetailText(details: unknown, topMessage = '') {
  const data = recordOf(details);
  const nested = recordOf(data.details);
  const top = normalizeText(topMessage).toLowerCase();
  const nestedMessage = normalizeText(nested.message);
  const parts = uniqueParts([
    data.type ? `type ${String(data.type)}` : '',
    data.status ? `status ${String(data.status)}` : '',
    data.path ? `path ${String(data.path)}` : '',
    nested.code ? `code ${String(nested.code)}` : '',
    nestedMessage && nestedMessage.toLowerCase() !== top ? `message ${nestedMessage}` : '',
    data.otpRequired ? 'otpRequired true' : '',
  ]);
  return parts.join(' | ');
}

function isRecoverableAncillaryTimeout(error: NamThanhApiError) {
  const details = recordOf(error.details);
  const nested = recordOf(details.details);
  const text = [
    error.message,
    details.error,
    details.message,
    details.path,
    nested.message,
    nested.path,
  ]
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean)
    .join(' ');

  return text.includes('session time out') || text.includes('booking/ancillaries');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as HoldBookingRequest & Record<string, unknown>;
    const outbound = body.outbound || body.flight;
    const inbound = body.inbound;
    const searchId = String(body.searchId || outbound?.searchId || '');
    const flightId = String(body.flightId || outbound?.id || outbound?.namthanh?.flightId || '');
    const fareId = body.fareId || outbound?.fareId || outbound?.namthanh?.fareId;
    const isRoundtrip = body.tripType === 'roundtrip' && !!outbound && !!inbound;

    if (!isRoundtrip && (!searchId || !flightId) && !(body.from && body.to && body.date)) {
      return NextResponse.json({
        error: 'Thiếu searchId/flightId cho ancillaries.',
      }, { status: 400 });
    }

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
  } catch (error: unknown) {
    if (error instanceof NamThanhApiError) {
      if (isOptionalAncillaryUnavailable(error)) {
        return NextResponse.json({
          success: true,
          routes: [],
          warning: 'ANCILLARY_UNAVAILABLE',
          message: 'Hãng này hiện chưa trả dữ liệu hành lý ký gửi. Anh vẫn có thể giữ chỗ không kèm hành lý.',
          details: error.details,
        });
      }

      if (isRecoverableAncillaryTimeout(error)) {
        return NextResponse.json({
          success: true,
          routes: [],
          warning: 'ANCILLARY_SESSION_TIMEOUT',
          message: 'Hành lý ký gửi tạm thời chưa tải được từ Nam Thanh. Anh vẫn có thể giữ chỗ không kèm hành lý.',
          details: error.details,
        });
      }

      const topMessage = normalizeText(error.message);
      const details = backendDetailText(error.details, topMessage);
      const msg = details ? `${topMessage} (${details})` : topMessage;
      const status = error.status >= 400 ? error.status : 502;
      return NextResponse.json({
        success: false,
        error: msg || 'Lỗi ancillaries Nam Thanh',
        details: error.details,
      }, { status });
    }

    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg || 'Lỗi ancillaries Nam Thanh' }, { status: 500 });
  }
}
