const DEFAULT_BACKEND_URL = 'http://localhost:3100';
const FALLBACK_RATE = Number.parseFloat(process.env.VND_USD_FALLBACK_RATE || '26357') || 26357;
const CACHE_TTL_MS = Number.parseInt(process.env.VND_USD_CACHE_TTL_SECONDS || '300', 10) * 1000;

let cache: { rate: number; fetchedAt: number } | null = null;
let inflight: Promise<number> | null = null;

function backendUrl(): string {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

async function fetchFromBackend(): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${backendUrl()}/config/exchange-rate`, {
      method: 'GET',
      headers: backendHeaders(),
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    const rate = Number(data?.rate);
    if (!res.ok || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(data?.error || `Exchange rate fetch failed: HTTP ${res.status}`);
    }
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVndUsdRate(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.rate;
  if (inflight) return inflight;

  inflight = fetchFromBackend()
    .then((rate) => {
      cache = { rate, fetchedAt: Date.now() };
      return rate;
    })
    .catch((error) => {
      console.warn('[exchange] Backend rate unavailable, using fallback:', error?.message || error);
      if (cache) return cache.rate;
      return FALLBACK_RATE;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getCachedVndUsdRate(): number {
  return cache?.rate ?? FALLBACK_RATE;
}

export function toUsd(vnd: number, rate?: number): number {
  const r = rate && Number.isFinite(rate) && rate > 0 ? rate : getCachedVndUsdRate();
  return Math.round(Number(vnd || 0) / r);
}
