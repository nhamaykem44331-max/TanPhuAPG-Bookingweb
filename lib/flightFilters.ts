import type { FlightResult } from '@/lib/types';

export type StopFilter = 'all' | '0' | '1' | '2+';
export type DepartureWindowFilter = 'all' | 'early' | 'morning' | 'afternoon' | 'evening';
export type DurationFilter = 'all' | 'short' | 'medium' | 'long';

export type FilterState = {
  airlines: string[];
  stops: StopFilter;
  departureWindow: DepartureWindowFilter;
  duration: DurationFilter;
};

export const EMPTY_FILTER_STATE: FilterState = {
  airlines: [],
  stops: 'all',
  departureWindow: 'all',
  duration: 'all',
};

function departureHour(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours();
}

function matchesDepartureWindow(value: string | undefined, filter: DepartureWindowFilter) {
  if (filter === 'all') return true;
  const hour = departureHour(value);
  if (hour === null) return true;
  if (filter === 'early') return hour >= 0 && hour < 6;
  if (filter === 'morning') return hour >= 6 && hour < 12;
  if (filter === 'afternoon') return hour >= 12 && hour < 18;
  return hour >= 18 && hour < 24;
}

export function flightMatchesFilter(flight: FlightResult, filter: FilterState) {
  if (filter.airlines.length > 0 && !filter.airlines.includes(flight.airlineCode)) return false;
  if (filter.stops === '0' && flight.stops !== 0) return false;
  if (filter.stops === '1' && flight.stops !== 1) return false;
  if (filter.stops === '2+' && flight.stops < 2) return false;
  if (!matchesDepartureWindow(flight.departure?.time, filter.departureWindow)) return false;
  return true;
}

export function applyFlightFilter(flights: FlightResult[], filter: FilterState) {
  return flights.filter((flight) => flightMatchesFilter(flight, filter));
}
