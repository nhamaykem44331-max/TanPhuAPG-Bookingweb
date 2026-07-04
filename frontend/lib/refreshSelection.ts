import type { Cabin, FlightResult, SearchResponse, TripType } from '@/lib/types';

export const QUOTE_SELECTION_KEY = 'apg_quote_selection';

export type QuoteSelection = {
  tripType: TripType;
  outbound: FlightResult;
  inbound?: FlightResult | null;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  search: { from: string; to: string; date: string; returnDate?: string };
  searchExpiresAt?: string;
  createdAt?: string;
  quoteCode?: string;
};

function flightDateKey(flight?: FlightResult | null) {
  const value = String(flight?.departure?.time || '');
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function flightTimeKey(flight?: FlightResult | null) {
  const value = String(flight?.departure?.time || '');
  const direct = value.match(/T(\d{2}:\d{2})|(?:^|\s)(\d{1,2}:\d{2})/);
  if (direct) return (direct[1] || direct[2] || '').padStart(5, '0');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function normalizedFlightNumber(value?: string) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

function flightSelectionMatches(target: FlightResult, candidate: FlightResult) {
  return (
    String(candidate.airlineCode || '').toUpperCase() === String(target.airlineCode || '').toUpperCase() &&
    normalizedFlightNumber(candidate.flightNumber) === normalizedFlightNumber(target.flightNumber) &&
    String(candidate.departure?.airport || '').toUpperCase() === String(target.departure?.airport || '').toUpperCase() &&
    String(candidate.arrival?.airport || '').toUpperCase() === String(target.arrival?.airport || '').toUpperCase() &&
    flightDateKey(candidate) === flightDateKey(target) &&
    flightTimeKey(candidate) === flightTimeKey(target)
  );
}

function uniqueFlights(items: Array<FlightResult | undefined | null>) {
  const seen = new Set<string>();
  return items.filter((item): item is FlightResult => {
    if (!item) return false;
    const key = [
      item.id,
      item.fareId,
      item.airlineCode,
      normalizedFlightNumber(item.flightNumber),
      item.departure?.airport,
      item.arrival?.airport,
      flightDateKey(item),
      flightTimeKey(item),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function refreshedFlightCandidates(response: SearchResponse, leg: 'outbound' | 'inbound') {
  const pairFlights = (response.pairOptions || []).map((pair) => (
    leg === 'outbound' ? pair.outbound : pair.inbound
  ));
  const directional = leg === 'outbound' ? response.departureResults || [] : response.returnResults || [];
  return uniqueFlights([...directional, ...pairFlights, ...(response.results || [])]);
}

function findRefreshedFlight(target: FlightResult, response: SearchResponse, leg: 'outbound' | 'inbound') {
  return refreshedFlightCandidates(response, leg).find((candidate) => flightSelectionMatches(target, candidate)) || null;
}

/**
 * Re-run the search behind a stored quote selection and return a fresh selection with
 * re-priced flights + a new searchExpiresAt. Throws (with a customer-facing message) when
 * the previously chosen flight is no longer available. Pure data — callers persist it and
 * update their own state.
 */
export async function refreshSelection(sel: QuoteSelection): Promise<QuoteSelection> {
  const isRoundtrip = sel.tripType === 'roundtrip' && !!sel.inbound;

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: sel.search.from,
      to: sel.search.to,
      date: sel.search.date,
      returnDate: isRoundtrip ? sel.search.returnDate : undefined,
      tripType: sel.tripType,
      adults: sel.adults,
      children: sel.children,
      infants: sel.infants,
      cabin: sel.cabin,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as SearchResponse & { error?: string; message?: string };

  if (!res.ok) {
    throw new Error(body.error || body.message || 'Không làm mới được phiên giá.');
  }

  const nextOutbound = findRefreshedFlight(sel.outbound, body, 'outbound');
  const nextInbound = isRoundtrip && sel.inbound ? findRefreshedFlight(sel.inbound, body, 'inbound') : undefined;

  if (!nextOutbound || (isRoundtrip && sel.inbound && !nextInbound)) {
    throw new Error('Phiên giá đã hết hạn và chuyến bay cũ không còn khớp. Vui lòng quay lại tìm kiếm để chọn chuyến mới.');
  }

  return {
    ...sel,
    outbound: nextOutbound,
    inbound: isRoundtrip ? (nextInbound || sel.inbound) : undefined,
    searchExpiresAt: body.metadata?.expiresAt,
    createdAt: new Date().toISOString(),
  };
}
