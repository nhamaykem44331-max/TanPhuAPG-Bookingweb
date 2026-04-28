import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFlightBadges, minFlightPrice } from './flight-badges';
import type { FlightResult } from './types';

function flight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    id: 'f1',
    airline: 'VietJet Air',
    airlineCode: 'VJ',
    flightNumber: 'VJ123',
    departure: { airport: 'HAN', airportName: 'HAN', city: 'HAN', time: '2026-05-20T08:00:00+07:00' },
    arrival: { airport: 'SGN', airportName: 'SGN', city: 'SGN', time: '2026-05-20T10:10:00+07:00' },
    duration: 130,
    stops: 0,
    price: { amount: 1_000_000, currency: 'VND', source: 'namthanh' },
    priceUSD: 40,
    sources: ['namthanh'],
    ...overrides,
  };
}

test('minFlightPrice returns the lowest visible flight total', () => {
  assert.equal(minFlightPrice([
    flight({ price: { amount: 1_500_000, currency: 'VND', source: 'namthanh' } }),
    flight({ price: { amount: 1_200_000, currency: 'VND', source: 'namthanh' } }),
  ]), 1_200_000);
});

test('buildFlightBadges marks cheapest flight', () => {
  assert.deepEqual(
    buildFlightBadges(flight(), 1_000_000).map((badge) => badge.key),
    ['cheapest']
  );
});

test('buildFlightBadges uses Nam Thanh fare metadata for baggage', () => {
  const badges = buildFlightBadges(flight({
    namthanh: {
      carryOnText: '7kg',
      checkedBaggageText: '20kg',
    },
  }));

  assert.deepEqual(badges.map((badge) => badge.label), ['Xách tay 7kg', 'Ký gửi 20kg']);
});

test('buildFlightBadges marks business fare only when metadata says business', () => {
  const badges = buildFlightBadges(flight({
    namthanh: {
      cabinClass: 'Business',
      fareFamily: 'Business Flex',
    },
  }));

  assert.deepEqual(badges.map((badge) => badge.key), ['business']);
});
