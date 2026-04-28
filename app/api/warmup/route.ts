/**
 * GET /api/warmup
 * User-triggered warmup: FE gọi khi vừa mở trang để backend login/refresh
 * session sẵn sàng trước khi user bấm "Tìm vé".
 *
 * Proxy tới backend `/session/ensure` (cheap, < 100ms khi đã warm).
 * Luôn trả 200 để FE không bao giờ vỡ UI vì warmup lỗi.
 */
import { NextResponse } from 'next/server';

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
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${backendUrl()}/session/ensure`, {
      method: 'GET',
      headers: backendHeaders(),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ...data, proxyLatencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Không phải lỗi user-facing — chỉ là warmup fail, FE vẫn cho user tìm bình thường.
    return NextResponse.json(
      { ready: false, warming: false, error: message, proxyLatencyMs: Date.now() - started },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
