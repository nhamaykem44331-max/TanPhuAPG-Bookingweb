/**
 * POST /api/n8n/hold
 * Hold a booking through Nam Thanh backend.
 * Header: x-api-key: YOUR_SECRET_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { holdNamThanhBooking, NamThanhApiError } from '@/lib/namthanh';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';
import type { HoldBookingPassenger, HoldBookingRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function backendDetailText(details: unknown) {
  const data = recordOf(details);
  const nested = recordOf(data.details);
  const nestedErrors = recordOf(nested.errors);
  const dataErrors = recordOf(data.errors);
  const errorList = [nestedErrors, dataErrors]
    .flatMap((source) => Object.entries(source))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .filter(Boolean);
  const parts = [
    data.type ? `type ${String(data.type)}` : '',
    data.status ? `status ${String(data.status)}` : '',
    data.path ? `path ${String(data.path)}` : '',
    nested.code ? `code ${String(nested.code)}` : '',
    nested.message ? `message ${String(nested.message)}` : '',
    data.otpRequired ? 'otpRequired true' : '',
    errorList.join(' | '),
  ].filter(Boolean);
  return parts.join(' | ');
}

function normalizePassengerType(value: unknown, fallback: 'ADT' | 'CHD' | 'INF' = 'ADT'): 'ADT' | 'CHD' | 'INF' {
  const type = String(value || fallback).trim().toUpperCase();
  if (type === 'CHD' || type === 'INF' || type === 'ADT') return type;
  return fallback;
}

function compactText(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeDob(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return text;
}

function normalizePassengers(body: HoldBookingRequest & Record<string, unknown>): HoldBookingPassenger[] {
  const hasCounts = body.adults !== undefined || body.children !== undefined || body.infants !== undefined;
  const adults = Number(body.adults ?? 1);
  const children = Number(body.children ?? 0);
  const infants = Number(body.infants ?? 0);
  const provided = Array.isArray(body.passengers) ? body.passengers.filter(Boolean) : [];
  if (provided.length === 0 && body.passenger) {
    if (typeof body.passenger === 'string') {
      provided.push({
        id: 'ADT1',
        type: 'ADT',
        title: 'MR',
        fullName: compactText(body.passenger),
      });
    } else if (typeof body.passenger === 'object') {
      provided.push(body.passenger as HoldBookingPassenger);
    }
  }
  if (provided.length === 0) return [];

  const expectedTotal = adults + children + infants;
  if (hasCounts && expectedTotal > 0 && provided.length !== expectedTotal) {
    throw new Error(`Số hành khách không khớp. Cần ${expectedTotal}, nhận ${provided.length}.`);
  }

  const counts = { ADT: 0, CHD: 0, INF: 0 };
  const normalized = provided.map((item, index) => {
    const fallbackType: 'ADT' | 'CHD' | 'INF' = hasCounts
      ? (index < adults ? 'ADT'
        : index < adults + children ? 'CHD'
          : 'INF')
      : normalizePassengerType(item.type, 'ADT');
    const type = normalizePassengerType(item.type, fallbackType);
    counts[type] += 1;
    const fullName = compactText(item.fullName || item.name || `${item.lastName || ''} ${item.firstName || ''}`);
    const dob = normalizeDob(item.dateOfBirth || item.birthday || '');
    if (!fullName) throw new Error(`Hành khách thứ ${index + 1} chưa có họ tên.`);
    if (type === 'CHD' && !dob) throw new Error(`Trẻ em thứ ${index + 1} bắt buộc có ngày sinh.`);
    return {
      ...item,
      id: item.id || `${type}${counts[type]}`,
      type,
      title: compactText(item.title || (type === 'ADT' ? 'MR' : 'MSTR')),
      fullName,
      ...(dob ? { dateOfBirth: dob, birthday: dob } : {}),
      listLuggage: Array.isArray(item.listLuggage) ? item.listLuggage : [],
      ancillaryServices: Array.isArray(item.ancillaryServices) ? item.ancillaryServices : [],
    } satisfies HoldBookingPassenger;
  });

  if (hasCounts && (counts.ADT !== adults || counts.CHD !== children || counts.INF !== infants)) {
    throw new Error(`Loại khách không khớp ADT/CHD/INF (${counts.ADT}/${counts.CHD}/${counts.INF}) với yêu cầu (${adults}/${children}/${infants}).`);
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: HoldBookingRequest & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const passengers = normalizePassengers(body);
  const passenger = passengers[0];
  const flight = body.flight;
  const searchId = String(body.searchId || flight?.searchId || '');
  const flightId = String(body.flightId || flight?.id || flight?.namthanh?.flightId || '');
  const fareId = body.fareId || flight?.fareId || flight?.namthanh?.fareId;
  const idempotencyKey = String(body.idempotencyKey || req.headers.get('idempotency-key') || '');

  if (!searchId || !flightId) {
    return NextResponse.json({ error: 'Thiếu searchId/flightId' }, { status: 400 });
  }
  if (!passenger) {
    return NextResponse.json({ error: 'Thiếu passenger' }, { status: 400 });
  }

  try {
    const result = await holdNamThanhBooking({
      searchId,
      flightId,
      fareId,
      flight,
      passenger: passenger as HoldBookingRequest['passenger'],
      passengers,
      contact: body.contact,
      dryRun: body.dryRun === false ? false : true,
      idempotencyKey,
    }, idempotencyKey || undefined);

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
