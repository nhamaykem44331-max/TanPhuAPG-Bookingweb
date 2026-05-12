import assert from 'node:assert/strict';
import test from 'node:test';

import { applyFlightFilter, type FilterState } from '@/lib/flightFilters';
import type { FlightResult } from '@/lib/types';

function flight(overrides: Partial<FlightResult>): FlightResult {
  return {
    id: 'f1',
    airline: 'Vietnam Airlines',
    airlineCode: 'VN',
    flightNumber: 'VN123',
    departure: {
      airport: 'HAN',
      airportName: 'Noi Bai',
      city: 'Ha Noi',
      time: '2026-05-20T07:30:00',
    },
    arrival: {
      airport: 'SGN',
      airportName: 'Tan Son Nhat',
      city: 'Ho Chi Minh',
      time: '2026-05-20T09:40:00',
    },
    duration: 130,
    stops: 0,
    price: {
      amount: 1500000,
      currency: 'VND',
      source: 'test',
    },
    priceUSD: 60,
    sources: ['test'],
    ...overrides,
  };
}

const baseFilter: FilterState = {
  airlines: [],
  stops: 'all',
  departureWindow: 'all',
  duration: 'all',
};

test('applyFlightFilter filters by airline, stops, and departure window', () => {
  const flights = [
    flight({ id: 'morning-direct', airlineCode: 'VN', duration: 95, stops: 0, departure: { airport: 'HAN', airportName: 'Noi Bai', city: 'Ha Noi', time: '2026-05-20T07:30:00' } }),
    flight({ id: 'evening-one-stop', airlineCode: 'VJ', duration: 210, stops: 1, departure: { airport: 'HAN', airportName: 'Noi Bai', city: 'Ha Noi', time: '2026-05-20T19:10:00' } }),
    flight({ id: 'long-two-stop', airlineCode: 'QH', duration: 310, stops: 2, departure: { airport: 'HAN', airportName: 'Noi Bai', city: 'Ha Noi', time: '2026-05-20T13:15:00' } }),
  ];

  assert.deepEqual(applyFlightFilter(flights, { ...baseFilter, airlines: ['VJ'] }).map((item) => item.id), ['evening-one-stop']);
  assert.deepEqual(applyFlightFilter(flights, { ...baseFilter, stops: '2+' }).map((item) => item.id), ['long-two-stop']);
  assert.deepEqual(applyFlightFilter(flights, { ...baseFilter, departureWindow: 'morning' }).map((item) => item.id), ['morning-direct']);
  assert.deepEqual(applyFlightFilter(flights, { ...baseFilter, duration: 'long' }).map((item) => item.id), ['morning-direct', 'evening-one-stop', 'long-two-stop']);
});
