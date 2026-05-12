import { NextResponse } from 'next/server';
import { z } from 'zod';

import { OBSERVABILITY_VIEWER_ROLES } from '@/lib/auth/constants';
import { requireRole, toAdminErrorResponse } from '@/lib/auth/requireRole';
import { getWebVitalsSnapshot, recordWebVital } from '@/lib/analytics/webVitals';
import { getPersistentWebVitalsSnapshot, persistWebVitalRecord } from '@/lib/analytics/webVitalsPersistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const webVitalSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(32),
  label: z.string().trim().max(80).optional(),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  startTime: z.number().finite().optional(),
  navigationType: z.string().trim().max(80).optional(),
  path: z.string().trim().max(180).optional(),
  timestamp: z.number().finite().optional(),
});

async function readPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json();
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = webVitalSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_WEB_VITAL_METRIC' }, { status: 400 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const record = recordWebVital(parsed.data, {
    ip: forwardedFor.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent'),
  });
  if (record) {
    await persistWebVitalRecord(record);
  }

  return new Response(null, { status: 204 });
}

export async function GET() {
  try {
    await requireRole(OBSERVABILITY_VIEWER_ROLES);
    return NextResponse.json((await getPersistentWebVitalsSnapshot()) || getWebVitalsSnapshot());
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
