import assert from 'node:assert/strict';
import test from 'node:test';

import { isFlightBookable, isPairOptionBookable } from './namthanh';
import type { FlightResult, RoundtripPairOption } from './types';

function flight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    id: overrides.id ?? 'vj-soldout',
    airline: overrides.airline ?? 'VietJet Air',
    airlineCode: overrides.airlineCode ?? 'VJ',
    flightNumber: overrides.flightNumber ?? 'VJ512',
    departure: overrides.departure ?? {
      airport: 'DAD',
      airportName: 'Da Nang',
      city: 'Da Nang',
      time: '2026-05-17T16:55:00+07:00',
    },
    arrival: overrides.arrival ?? {
      airport: 'HAN',
      airportName: 'Noi Bai',
      city: 'Ha Noi',
      time: '2026-05-17T18:15:00+07:00',
    },
    duration: overrides.duration ?? 80,
    stops: overrides.stops ?? 0,
    price: overrides.price ?? { amount: 690_600, currency: 'VND', source: 'namthanh' },
    priceUSD: overrides.priceUSD ?? 28,
    sources: overrides.sources ?? ['namthanh'],
    ...overrides,
  };
}

test('isFlightBookable rejects selected fare with zero seats even when it has a price', () => {
  const item = flight({
    fareId: 'E-E1_ECO-0',
    namthanh: {
      fareId: 'E-E1_ECO-0',
      flightId: '7-VJ_DADHAN_1655_1815',
      seatAvailable: 0,
    },
    fareOptions: [
      {
        id: 'E-E1_ECO-0',
        class: 'E',
        cabinClass: 'Eco',
        fareBasis: 'E1_ECO',
        seatAvailable: 0,
        totalAmount: 690_600,
      },
    ],
  });

  assert.equal(isFlightBookable(item), false);
});

test('isFlightBookable keeps a flight when the selected fare still has seats', () => {
  const item = flight({
    fareId: 'E-L1_ECO-0',
    namthanh: {
      fareId: 'E-L1_ECO-0',
      flightId: '16-VJ_DADHAN_0730_0850',
      seatAvailable: 18,
    },
    fareOptions: [
      { id: 'E-L1_ECO-0', seatAvailable: 18, totalAmount: 2_278_200 },
      { id: 'D_Boss-D_Boss-3', seatAvailable: 0, totalAmount: 5_658_600 },
    ],
  });

  assert.equal(isFlightBookable(item), true);
});

test('isFlightBookable rejects explicit sold-out status text', () => {
  const item = flight({
    namthanh: {
      flightId: '7-VJ_DADHAN_1655_1815',
      fareId: 'E-E1_ECO-0',
      status: 'Het Cho',
    } as FlightResult['namthanh'],
  });

  assert.equal(isFlightBookable(item), false);
});

test('isPairOptionBookable rejects a roundtrip pair when either leg is sold out', () => {
  const outbound = flight({ id: 'out', namthanh: { seatAvailable: 1 } });
  const inbound = flight({ id: 'in', namthanh: { seatAvailable: 0 } });
  const pair: RoundtripPairOption = {
    id: 'pair-1',
    source: 'namthanh',
    outboundFlightId: outbound.id,
    inboundFlightId: inbound.id,
    outbound,
    inbound,
    totalAmount: 1_381_200,
    currency: 'VND',
    totalUSD: 55,
    airlines: ['VJ'],
    stops: 0,
  };

  assert.equal(isPairOptionBookable(pair), false);
});
