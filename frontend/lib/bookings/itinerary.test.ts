import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildItinerary, extractItinerary, type ItinerarySourceBooking } from "./itinerary";
import type { FlightResult } from "../types";

function makeFlight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    id: "o1",
    airline: "VietJet Air",
    airlineCode: "VJ",
    flightNumber: "VJ163",
    departure: { airport: "HAN", airportName: "Noi Bai", city: "Ha Noi", time: "2026-06-30T21:25:00+07:00" },
    arrival: { airport: "SGN", airportName: "Tan Son Nhat", city: "Ho Chi Minh", time: "2026-06-30T23:35:00+07:00" },
    duration: 130,
    stops: 0,
    price: { amount: 1000000, currency: "VND", source: "namthanh" },
    priceUSD: 40,
    sources: ["namthanh"],
    namthanh: {
      cabinClass: "Eco",
      segments: [
        {
          carrierCode: "VJ",
          flightNumber: "163",
          from: "HAN",
          to: "SGN",
          departDate: "30-06-2026 21:25",
          arrivalDate: "30-06-2026 23:35",
          airCraft: "321",
        },
      ],
    },
    ...overrides,
  };
}

describe("buildItinerary", () => {
  it("dựng leg từ namthanh.segments với số hiệu chuyến đầy đủ", () => {
    const { legs } = buildItinerary(makeFlight(), undefined, "ECO");

    assert.equal(legs.length, 1);
    const [leg] = legs;
    assert.equal(leg.direction, "outbound");
    assert.equal(leg.route, "HAN-SGN");
    assert.equal(leg.cabin, "ECO"); // cabin truyền vào ưu tiên hơn namthanh.cabinClass
    assert.equal(leg.segments.length, 1);
    assert.equal(leg.segments[0].flightNumber, "VJ163");
    assert.equal(leg.segments[0].from, "HAN");
    assert.equal(leg.segments[0].to, "SGN");
    assert.equal(leg.segments[0].aircraft, "321");
    // "30-06-2026 21:25" (giờ VN) → ISO UTC
    assert.equal(leg.segments[0].departAt, "2026-06-30T14:25:00.000Z");
  });

  it("fallback một segment khi không có namthanh.segments", () => {
    const { legs } = buildItinerary(makeFlight({ namthanh: { cabinClass: "Eco" } }), undefined, undefined);

    assert.equal(legs.length, 1);
    assert.equal(legs[0].segments.length, 1);
    assert.equal(legs[0].segments[0].flightNumber, "VJ163"); // từ flightNumber cấp cao
    assert.equal(legs[0].segments[0].from, "HAN");
    assert.equal(legs[0].cabin, "Eco"); // rơi về namthanh.cabinClass
  });

  it("roundtrip tạo 2 leg outbound + inbound", () => {
    const inbound = makeFlight({
      id: "i1",
      flightNumber: "VJ164",
      departure: { airport: "SGN", airportName: "Tan Son Nhat", city: "Ho Chi Minh", time: "2026-07-05T10:00:00+07:00" },
      arrival: { airport: "HAN", airportName: "Noi Bai", city: "Ha Noi", time: "2026-07-05T12:10:00+07:00" },
      namthanh: {
        cabinClass: "Eco",
        segments: [
          { carrierCode: "VJ", flightNumber: "164", from: "SGN", to: "HAN", departDate: "05-07-2026 10:00", arrivalDate: "05-07-2026 12:10" },
        ],
      },
    });
    const { legs } = buildItinerary(makeFlight(), inbound, "ECO");

    assert.equal(legs.length, 2);
    assert.equal(legs[0].direction, "outbound");
    assert.equal(legs[1].direction, "inbound");
    assert.equal(legs[1].route, "SGN-HAN");
    assert.equal(legs[1].segments[0].flightNumber, "VJ164");
  });
});

describe("extractItinerary", () => {
  function booking(overrides: Partial<ItinerarySourceBooking>): ItinerarySourceBooking {
    return {
      namthanhRawJson: {},
      routeSummary: null,
      airline: null,
      cabin: null,
      departAt: null,
      returnAt: null,
      ...overrides,
    };
  }

  it("ưu tiên itinerary đã lưu (source=stored)", () => {
    const stored = booking({
      namthanhRawJson: { itinerary: buildItinerary(makeFlight(), undefined, "ECO") },
      routeSummary: "HAN-SGN",
      airline: "VJ",
    });

    const result = extractItinerary(stored);
    assert.ok(result);
    assert.equal(result.source, "stored");
    assert.equal(result.legs[0].segments[0].flightNumber, "VJ163");
  });

  it("đơn cũ: dựng từ quote.legs + bổ sung số hiệu chiều đi từ holdResult", () => {
    const legacy = booking({
      namthanhRawJson: {
        quote: {
          legs: [
            { legKey: "outbound", airline: "VJ", route: "HAN-SGN", cabin: "ECO", departureAt: "2026-06-30T21:25:00+07:00", arrivalAt: "2026-06-30T23:35:00+07:00" },
            { legKey: "inbound", airline: "VJ", route: "SGN-HAN", cabin: "ECO", departureAt: "2026-07-05T10:00:00+07:00", arrivalAt: "2026-07-05T12:10:00+07:00" },
          ],
        },
        holdResult: {
          flight: {
            flightNumber: "VJ163",
            segments: [
              { carrierCode: "VJ", flightNumber: "163", from: "HAN", to: "SGN", departDate: "30-06-2026 21:25", arrivalDate: "30-06-2026 23:35", airCraft: "321" },
            ],
          },
        },
      },
      routeSummary: "HAN-SGN / SGN-HAN",
      airline: "VJ",
    });

    const result = extractItinerary(legacy);
    assert.ok(result);
    assert.equal(result.source, "quote");
    assert.equal(result.legs.length, 2);
    // chiều đi lấy được số hiệu từ holdResult.flight.segments
    assert.equal(result.legs[0].segments[0].flightNumber, "VJ163");
    assert.equal(result.legs[0].segments[0].from, "HAN");
    // chiều về không có dữ liệu segment → synthetic, không có số hiệu nhưng vẫn đúng route/giờ
    assert.equal(result.legs[1].route, "SGN-HAN");
    assert.equal(result.legs[1].segments[0].flightNumber, null);
    assert.equal(result.legs[1].segments[0].from, "SGN");
    assert.ok(result.legs[1].departAt);
  });

  it("đơn tối thiểu: dựng từ routeSummary + departAt/returnAt (source=route)", () => {
    const minimal = booking({
      namthanhRawJson: {},
      routeSummary: "HAN-SGN / SGN-HAN",
      airline: "VJ",
      cabin: "ECO",
      departAt: new Date("2026-06-30T21:25:00+07:00"),
      returnAt: new Date("2026-07-05T10:00:00+07:00"),
    });

    const result = extractItinerary(minimal);
    assert.ok(result);
    assert.equal(result.source, "route");
    assert.equal(result.legs.length, 2);
    assert.equal(result.legs[0].route, "HAN-SGN");
    assert.equal(result.legs[0].airline, "VJ");
    assert.equal(result.legs[0].segments[0].flightNumber, null);
    assert.equal(result.legs[0].departAt, "2026-06-30T14:25:00.000Z");
    assert.equal(result.legs[1].route, "SGN-HAN");
  });

  it("trả null khi không có bất kỳ nguồn dữ liệu nào", () => {
    assert.equal(extractItinerary(booking({})), null);
  });
});
