export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalInput {
  id: string;
  name: string;
  label?: string;
  value: number;
  rating?: WebVitalRating;
  startTime?: number;
  navigationType?: string;
  path?: string;
  timestamp?: number;
}

export interface WebVitalRecord extends Required<Pick<WebVitalInput, 'id' | 'name' | 'value' | 'path' | 'timestamp'>> {
  label: string;
  rating: WebVitalRating | null;
  startTime: number | null;
  navigationType: string | null;
  userAgent: string | null;
  ip: string | null;
}

export interface WebVitalMetricSummary {
  name: string;
  count: number;
  p75: number;
  latestValue: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface WebVitalPathSummary {
  path: string;
  count: number;
  latestTimestamp: number;
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
}

export interface WebVitalsSnapshot {
  generatedAt: string;
  total: number;
  byMetric: WebVitalMetricSummary[];
  byPath: WebVitalPathSummary[];
  recent: WebVitalRecord[];
}

interface WebVitalsStore {
  records: WebVitalRecord[];
}

const MAX_RECORDS = 600;
const MAX_RECENT = 80;

const globalForWebVitals = globalThis as typeof globalThis & {
  __tanphuApgWebVitals?: WebVitalsStore;
};

function store(): WebVitalsStore {
  if (!globalForWebVitals.__tanphuApgWebVitals) {
    globalForWebVitals.__tanphuApgWebVitals = { records: [] };
  }
  return globalForWebVitals.__tanphuApgWebVitals;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).trim().slice(0, 180);
}

function cleanPath(value: unknown) {
  const raw = cleanText(value, '/');
  return raw.startsWith('/') ? raw : '/';
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

export function recordWebVital(input: WebVitalInput, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return null;

  const record: WebVitalRecord = {
    id: cleanText(input.id),
    name: cleanText(input.name).toUpperCase(),
    label: cleanText(input.label),
    value,
    rating: input.rating || null,
    startTime: Number.isFinite(Number(input.startTime)) ? Number(input.startTime) : null,
    navigationType: input.navigationType ? cleanText(input.navigationType) : null,
    path: cleanPath(input.path),
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Date.now(),
    userAgent: meta.userAgent ? cleanText(meta.userAgent) : null,
    ip: meta.ip ? cleanText(meta.ip) : null,
  };

  const target = store().records;
  target.push(record);
  if (target.length > MAX_RECORDS) {
    target.splice(0, target.length - MAX_RECORDS);
  }

  return record;
}

export function buildWebVitalsSnapshot(inputRecords: WebVitalRecord[]): WebVitalsSnapshot {
  const records = [...inputRecords].sort((a, b) => b.timestamp - a.timestamp);
  const metricNames = [...new Set(records.map((record) => record.name))].sort();
  const paths = [...new Set(records.map((record) => record.path))];

  const byMetric = metricNames.map((name) => {
    const subset = records.filter((record) => record.name === name);
    return {
      name,
      count: subset.length,
      p75: percentile(subset.map((record) => record.value), 75),
      latestValue: subset[0]?.value ?? 0,
      good: subset.filter((record) => record.rating === 'good').length,
      needsImprovement: subset.filter((record) => record.rating === 'needs-improvement').length,
      poor: subset.filter((record) => record.rating === 'poor').length,
    };
  });

  const byPath = paths.map((path) => {
    const subset = records.filter((record) => record.path === path);
    const valuesFor = (metric: string) => subset.filter((record) => record.name === metric).map((record) => record.value);
    const lcpValues = valuesFor('LCP');
    const inpValues = valuesFor('INP');
    const clsValues = valuesFor('CLS');
    return {
      path,
      count: subset.length,
      latestTimestamp: subset[0]?.timestamp ?? 0,
      lcpP75: lcpValues.length ? percentile(lcpValues, 75) : null,
      inpP75: inpValues.length ? percentile(inpValues, 75) : null,
      clsP75: clsValues.length ? percentile(clsValues, 75) : null,
    };
  }).sort((a, b) => b.latestTimestamp - a.latestTimestamp).slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    total: records.length,
    byMetric,
    byPath,
    recent: records.slice(0, MAX_RECENT),
  };
}

export function getWebVitalsSnapshot(): WebVitalsSnapshot {
  return buildWebVitalsSnapshot(store().records);
}

export function clearWebVitalsForTests() {
  store().records = [];
}
