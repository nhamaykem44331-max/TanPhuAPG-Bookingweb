import { useEffect, useState } from 'react';
import type { AirportOption, AirportRecord, AirportSelection } from './types';

const AIRPORTS_CACHE_KEY = 'apg_airports_v1';
const AIRPORTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AIRPORTS_CACHE_MAX_BYTES = 128 * 1024;
const POPULAR_AIRPORT_CODES = [
  'HAN', 'SGN', 'DAD', 'PQC', 'CXR', 'VII', 'HPH', 'HUI', 'VCA', 'DLI', 'UIH', 'VCL', 'BMV',
  'BKK', 'DMK', 'SIN', 'KUL', 'CAN', 'SZX', 'HKG', 'TPE', 'ICN', 'NRT', 'KIX', 'PVG', 'PEK',
];
const POPULAR_AIRPORT_RANK = new Map(POPULAR_AIRPORT_CODES.map((code, index) => [code, index]));
const AIRPORT_ALIASES: Record<string, string[]> = {
  SGN: ['TP Ho Chi Minh', 'Ho Chi Minh', 'Ho Chi Minh City', 'Sai Gon', 'Saigon', 'Tan Son Nhat', 'HCM', 'TPHCM'],
  HAN: ['Ha Noi', 'Hanoi', 'Noi Bai'],
  DAD: ['Da Nang', 'Danang'],
  BKK: ['Bangkok'],
  DMK: ['Bangkok Don Mueang', 'Bangkok'],
  CAN: ['Guangzhou', 'Quang Chau'],
  PQC: ['Phu Quoc'],
};

type AirportCachePayload = {
  version: number;
  fetchedAt: number;
  airports: AirportRecord[];
};

type AirportResource = {
  version: number;
  fetchedAt: number;
  airports: AirportOption[];
};

let memoryCache: AirportResource | null = null;
let inflightFetch: Promise<AirportResource & { error?: string }> | null = null;

export function normalizeAirportText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

export function formatAirportLabel(airport: Pick<AirportRecord, 'code' | 'city' | 'name'>): string {
  return `${airport.city} (${airport.code}) - ${airport.name}`;
}

function enrichAirport(airport: AirportRecord): AirportOption {
  const label = formatAirportLabel(airport);
  const aliases = AIRPORT_ALIASES[airport.code] || [];
  return {
    ...airport,
    label,
    aliases,
  };
}

function enrichAirports(airports: AirportRecord[]): AirportOption[] {
  return airports
    .map(enrichAirport)
    .sort((a, b) => {
      const rankA = POPULAR_AIRPORT_RANK.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const rankB = POPULAR_AIRPORT_RANK.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label, 'vi');
    });
}

function airportSearchTags(airport: AirportOption): string[] {
  const aliases = airport.aliases || AIRPORT_ALIASES[airport.code] || [];
  return [
    airport.code,
    airport.city,
    airport.name,
    airport.label,
    `${airport.city} ${airport.code}`,
    `${airport.city} ${airport.name}`,
    `${airport.name} ${airport.code}`,
    ...aliases,
  ];
}

function cacheableAirports(airports: AirportOption[]): AirportOption[] {
  const popular = airports.filter((airport) => POPULAR_AIRPORT_RANK.has(airport.code));
  return popular.length > 0 ? popular : airports.filter((airport) => airport.domestic).slice(0, 50);
}

function toCachePayload(resource: AirportResource): AirportCachePayload {
  const airports = cacheableAirports(resource.airports);
  return {
    version: resource.version,
    fetchedAt: resource.fetchedAt,
    airports: airports.map(({ code, city, name, country, domestic }) => ({
      code,
      city,
      name,
      country,
      domestic,
    })),
  };
}

function fromCachePayload(payload: AirportCachePayload): AirportResource {
  return {
    version: Number(payload.version) || 0,
    fetchedAt: Number(payload.fetchedAt) || 0,
    airports: enrichAirports(Array.isArray(payload.airports) ? payload.airports : []),
  };
}

function readLocalCache(): AirportResource | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AIRPORTS_CACHE_KEY);
    if (!raw) return null;
    if (raw.length > AIRPORTS_CACHE_MAX_BYTES) {
      localStorage.removeItem(AIRPORTS_CACHE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as AirportCachePayload;
    if (!parsed || !Array.isArray(parsed.airports)) return null;
    return fromCachePayload(parsed);
  } catch {
    return null;
  }
}

function writeLocalCache(resource: AirportResource) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AIRPORTS_CACHE_KEY, JSON.stringify(toCachePayload(resource)));
  } catch {
    // noop
  }
}

function isFresh(resource: AirportResource | null): boolean {
  return !!resource && Date.now() - resource.fetchedAt < AIRPORTS_CACHE_TTL_MS;
}

async function fetchAirportsFromServer(): Promise<AirportResource & { error?: string }> {
  const cached = memoryCache || readLocalCache();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('/api/airports', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    const rawAirports = Array.isArray(data?.airports) ? (data.airports as AirportRecord[]) : [];
    const version = Number(data?.version) || 0;
    const error = typeof data?.error === 'string' ? data.error : '';

    if (rawAirports.length > 0) {
      const resource: AirportResource = {
        version,
        fetchedAt: Date.now(),
        airports: enrichAirports(rawAirports),
      };

      if (!cached || version >= cached.version || !isFresh(cached)) {
        memoryCache = resource;
        writeLocalCache(resource);
        return error ? { ...resource, error } : resource;
      }

      memoryCache = cached;
      return error ? { ...cached, error } : cached;
    }

    if (cached) {
      memoryCache = cached;
      return error ? { ...cached, error } : cached;
    }

    return {
      version,
      fetchedAt: Date.now(),
      airports: [],
      error: error || 'Không tải được danh sách sân bay từ backend.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (cached) {
      memoryCache = cached;
      return { ...cached, error: message };
    }
    return {
      version: 0,
      fetchedAt: Date.now(),
      airports: [],
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function loadAirports(): Promise<AirportResource & { error?: string }> {
  if (!inflightFetch) {
    inflightFetch = fetchAirportsFromServer().finally(() => {
      inflightFetch = null;
    });
  }
  return inflightFetch;
}

export function filterAirports(airports: AirportOption[], query: string, limit = 8): AirportOption[] {
  const q = normalizeAirportText(query);
  if (!q) return airports.slice(0, limit);
  const scored = airports
    .map((airport) => {
      const code = normalizeAirportText(airport.code);
      const city = normalizeAirportText(airport.city);
      const name = normalizeAirportText(airport.name);
      const label = normalizeAirportText(airport.label);
      const aliases = (airport.aliases || []).map(normalizeAirportText);
      const tags = airportSearchTags(airport).map(normalizeAirportText);

      let score = -1;
      if (code === q) score = 1000;
      else if (aliases.some((alias) => alias === q)) score = 960;
      else if (city === q || name === q || label === q) score = 930;
      else if (aliases.some((alias) => alias.startsWith(q))) score = 880;
      else if (city.startsWith(q) || name.startsWith(q)) score = 820;
      else if (code.startsWith(q)) score = 780;
      else if (label.startsWith(q)) score = 740;
      else if (aliases.some((alias) => alias.includes(q))) score = 700;
      else if (city.includes(q) || name.includes(q)) score = 640;
      else if (tags.some((tag) => tag.startsWith(q))) score = 520;
      else if (tags.some((tag) => tag.includes(q))) score = 400;

      return { airport, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.airport.label.localeCompare(b.airport.label, 'vi'));

  return scored.slice(0, limit).map((entry) => entry.airport);
}

export function findAirportByCode(airports: AirportOption[], code: string): AirportOption | null {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) return null;
  return airports.find((airport) => airport.code === upper) || null;
}

export function buildAirportSelection(
  airports: AirportOption[],
  code: string,
  fallbackLabel = ''
): AirportSelection | null {
  const airport = findAirportByCode(airports, code);
  if (airport) return { code: airport.code, label: airport.label };
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) return null;
  return { code: upper, label: fallbackLabel || upper };
}

export function matchAirport(airports: AirportOption[], input: string): AirportOption | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  const codeMatch = airports.find((airport) => airport.code === upper);
  if (codeMatch) return codeMatch;

  const exactLabel = airports.find((airport) => airport.label.toUpperCase() === upper);
  if (exactLabel) return exactLabel;

  const byCodeInParens = raw.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase();
  if (byCodeInParens) {
    const inParens = airports.find((airport) => airport.code === byCodeInParens);
    if (inParens) return inParens;
  }

  const normalized = normalizeAirportText(raw);
  const exactNormalized = airports.find((airport) => (
    normalizeAirportText(airport.label) === normalized ||
    normalizeAirportText(airport.city) === normalized ||
    normalizeAirportText(airport.name) === normalized
  ));
  if (exactNormalized) return exactNormalized;

  const startsWith = airports.filter((airport) => airportSearchTags(airport).some((tag) => (
    normalizeAirportText(tag).startsWith(normalized)
  )));
  if (startsWith.length === 1) return startsWith[0];

  const contains = airports.filter((airport) => airportSearchTags(airport).some((tag) => (
    normalizeAirportText(tag).includes(normalized)
  )));
  if (contains.length === 1) return contains[0];

  return null;
}

export function legacyAirportCodeFromText(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return raw.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase() || '';
}

export function useAirports() {
  const initial = memoryCache || readLocalCache();
  const [airports, setAirports] = useState<AirportOption[]>(initial?.airports || []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const cached = memoryCache || readLocalCache();
    if (cached) {
      setAirports(cached.airports);
      setLoading(false);
    }

    loadAirports().then((resource) => {
      if (cancelled) return;
      if (resource.airports.length > 0) setAirports(resource.airports);
      setError(resource.error || '');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { airports, loading, error };
}
