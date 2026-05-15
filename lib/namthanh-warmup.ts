const DEFAULT_BACKEND_URL = 'http://localhost:3100';
const DEFAULT_TRIGGER_INTERVAL_MS = 60_000;
const DEFAULT_TRIGGER_TIMEOUT_MS = 5_000;

export interface NamThanhWarmupResult {
  ready?: boolean;
  warm?: boolean;
  warming?: boolean;
  error?: string;
  proxyLatencyMs: number;
  [key: string]: unknown;
}

let lastTriggeredAt = 0;
let inflightWarmup: Promise<NamThanhWarmupResult> | null = null;

function backendUrl(): string {
  return (process.env.NAMTHANH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function backendHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.NAMTHANH_BACKEND_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function ensureNamThanhSession(options: { timeoutMs?: number } = {}): Promise<NamThanhWarmupResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TRIGGER_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${backendUrl()}/session/ensure`, {
      method: 'GET',
      headers: backendHeaders(),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = asRecord(await response.json().catch(() => ({})));
    return {
      ...data,
      proxyLatencyMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ready: false,
      warming: false,
      error: message,
      proxyLatencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function triggerNamThanhSessionWarmup(reason: string = 'server-request'): Promise<NamThanhWarmupResult> | null {
  if (!envFlag('NAMTHANH_SERVER_WARMUP_ENABLED', true)) return null;
  if (inflightWarmup) return inflightWarmup;

  const now = Date.now();
  const minIntervalMs = envNumber('NAMTHANH_SERVER_WARMUP_MIN_INTERVAL_MS', DEFAULT_TRIGGER_INTERVAL_MS);
  if (now - lastTriggeredAt < minIntervalMs) return null;

  lastTriggeredAt = now;
  const timeoutMs = envNumber('NAMTHANH_SERVER_WARMUP_TIMEOUT_MS', DEFAULT_TRIGGER_TIMEOUT_MS);
  const debug = envFlag('NAMTHANH_WARMUP_DEBUG', false);

  inflightWarmup = ensureNamThanhSession({ timeoutMs })
    .then((result) => {
      if (debug) {
        console.debug('[warmup]', {
          reason,
          ready: result.ready,
          warming: result.warming,
          latencyMs: result.proxyLatencyMs,
        });
      }
      return result;
    })
    .finally(() => {
      inflightWarmup = null;
    });

  return inflightWarmup;
}
