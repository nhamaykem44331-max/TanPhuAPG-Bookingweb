interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 30_000;

export function getDashboardCache<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setDashboardCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}
