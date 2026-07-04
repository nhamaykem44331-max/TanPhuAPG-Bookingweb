import type { FlightResult, RoundtripPairOption } from '@/lib/types';

export function pairSourceLabel(value?: string) {
  const source = String(value || '').trim().toUpperCase();
  if (!source) return '';
  if (/^1[A-Z0-9]$/.test(source)) return source;
  const match = source.match(/(?:^|[^A-Z0-9])(1[A-Z0-9])$/);
  return match ? match[1] : source;
}

export function preferredRoundtripPairSourceFilter(_pairs: RoundtripPairOption[]) {
  return 'all';
}

export function pairOutboundSignature(flight?: FlightResult | null) {
  if (!flight) return '';
  return [
    flight.flightNumber,
    flight.departure?.airport || '',
    flight.arrival?.airport || '',
    flight.departure?.time || '',
    flight.arrival?.time || '',
    Number(flight.stops || 0),
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .join('|');
}

export function pairDedupKey(pair: RoundtripPairOption) {
  return [
    pairSourceLabel(pair.source || pair.systemName),
    pair.outbound?.flightNumber,
    pair.outbound?.departure?.airport,
    pair.outbound?.arrival?.airport,
    pair.outbound?.departure?.time,
    pair.outbound?.arrival?.time,
    pair.outboundFareId || pair.outbound?.fareId,
    pair.inbound?.flightNumber,
    pair.inbound?.departure?.airport,
    pair.inbound?.arrival?.airport,
    pair.inbound?.departure?.time,
    pair.inbound?.arrival?.time,
    pair.inboundFareId || pair.inbound?.fareId,
    pair.totalAmount,
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .join('|');
}

export function comparePairsByPrice(a: RoundtripPairOption, b: RoundtripPairOption) {
  if (a.totalAmount !== b.totalAmount) return a.totalAmount - b.totalAmount;
  const sourceCompare = pairSourceLabel(a.source || a.systemName).localeCompare(pairSourceLabel(b.source || b.systemName));
  if (sourceCompare !== 0) return sourceCompare;
  const outboundTimeCompare = +new Date(a.outbound.departure.time) - +new Date(b.outbound.departure.time);
  if (outboundTimeCompare !== 0) return outboundTimeCompare;
  return String(a.id).localeCompare(String(b.id));
}

export function mergeRoundtripPairs(existing: RoundtripPairOption[], incoming: RoundtripPairOption[]) {
  if (!incoming.length) return existing;
  const byKey = new Map(existing.map((pair) => [pairDedupKey(pair), pair]));
  incoming.forEach((pair) => {
    const key = pairDedupKey(pair);
    const prev = byKey.get(key);
    if (!prev || pair.totalAmount < prev.totalAmount) byKey.set(key, pair);
  });
  return [...byKey.values()].sort(comparePairsByPrice);
}

export function isBookablePair(pair: RoundtripPairOption) {
  return Boolean(
    pair.outbound?.searchId &&
    pair.inbound?.searchId &&
    pair.outboundFlightId &&
    pair.inboundFlightId &&
    (pair.outboundFareId || pair.outbound?.fareId) &&
    (pair.inboundFareId || pair.inbound?.fareId),
  );
}
