import assert from "node:assert/strict";
import { test } from "node:test";

import {
  toSafeFlight,
  toSafePair,
  filterBotOutput,
  containsSupplierLeak,
} from "./guardrail";
import type { FlightResult, RoundtripPairOption } from "@/lib/types";

// FlightResult "bẩn" — chứa mọi thứ nhạy cảm phải bị cắt trước khi vào model.
function dirtyFlight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    id: "F1",
    searchId: "SEARCH-INTERNAL-123",
    fareId: "FARE-INTERNAL-456",
    airline: "Vietnam Airlines",
    airlineCode: "VN",
    flightNumber: "VN213",
    departure: { airport: "HAN", airportName: "Nội Bài", city: "Hà Nội", time: "2026-07-15T06:00:00+07:00" },
    arrival: { airport: "SGN", airportName: "Tân Sơn Nhất", city: "Hồ Chí Minh", time: "2026-07-15T08:10:00+07:00" },
    duration: 130,
    stops: 0,
    price: { amount: 1_850_000, currency: "VND", source: "namthanh" },
    fareBreakdown: {
      baseAmount: 1_200_000,
      taxesFees: 650_000,
      totalAmount: 1_850_000,
      currency: "VND",
      perPax: { adt: 1_550_000, chd: 1_200_000, inf: 200_000 }, // GIÁ VỐN — cấm lộ
    },
    namthanh: {
      flightId: "NT-FLIGHT",
      fareId: "NT-FARE",
      systemName: "muadi",
      source: "muadi",
      class: "Y",
      segments: [{ carrierCode: "VN", airlineName: "Nam Thành GDS" }],
    },
    priceUSD: 71,
    sources: ["namthanh", "muadi"],
    ...overrides,
  };
}

test("toSafeFlight: giữ đúng thông tin an toàn", () => {
  const safe = toSafeFlight(dirtyFlight());
  assert.equal(safe.airline, "Vietnam Airlines");
  assert.equal(safe.airlineCode, "VN");
  assert.equal(safe.flightNumber, "VN213");
  assert.equal(safe.from.airport, "HAN");
  assert.equal(safe.to.airport, "SGN");
  assert.equal(safe.durationMinutes, 130);
  assert.equal(safe.stops, 0);
  assert.equal(safe.price, 1_850_000); // giá BÁN, không phải perPax.adt (1.550.000)
});

test("toSafeFlight: CẮT SẠCH dữ liệu nhà cung cấp / giá vốn", () => {
  const safe = toSafeFlight(dirtyFlight());
  const keys = Object.keys(safe);
  // Không có bất kỳ khóa nào mang dữ liệu nhạy cảm
  for (const forbidden of ["namthanh", "sources", "fareBreakdown", "perPax", "searchId", "fareId", "priceUSD", "detailUrl"]) {
    assert.ok(!keys.includes(forbidden), `SafeFlight không được chứa khóa "${forbidden}"`);
  }
  // Serialize toàn bộ: không lọt tên nhà cung cấp lẫn con số giá vốn
  const blob = JSON.stringify(safe).toLowerCase();
  assert.ok(!blob.includes("namthanh"), "không được chứa 'namthanh'");
  assert.ok(!blob.includes("muadi"), "không được chứa 'muadi'");
  assert.ok(!blob.includes("1550000"), "không được lộ perPax.adt (giá vốn)");
  assert.ok(!blob.includes("search-internal"), "không được lộ searchId nội bộ");
});

test("toSafePair: cắt sạch cả 2 chiều, giữ tổng giá bán", () => {
  const pair: RoundtripPairOption = {
    id: "P1",
    source: "muadi",
    systemName: "muadi",
    outboundFlightId: "F1",
    inboundFlightId: "F2",
    outbound: dirtyFlight(),
    inbound: dirtyFlight({ id: "F2", flightNumber: "VN214" }),
    totalAmount: 3_700_000,
    currency: "VND",
    totalUSD: 142,
    airlines: ["VN"],
    stops: 0,
  };
  const safe = toSafePair(pair);
  assert.equal(safe.totalPrice, 3_700_000);
  assert.equal(safe.airlines[0], "VN");
  const blob = JSON.stringify(safe).toLowerCase();
  assert.ok(!blob.includes("muadi"), "pair không được chứa 'muadi'");
  assert.ok(!blob.includes("namthanh"), "pair không được chứa 'namthanh'");
  assert.ok(!Object.keys(safe).includes("source"), "pair không được lộ source");
});

test("filterBotOutput: che tên nhà cung cấp, báo cờ leaked", () => {
  const cases = [
    "Đang chờ Nam Thành trả PNR",
    "hệ thống Nam Thanh",
    "namthanh backend",
    "id muadi",
  ];
  for (const input of cases) {
    const { text, leaked } = filterBotOutput(input);
    assert.equal(leaked, true, `phải phát hiện leak trong: ${input}`);
    assert.ok(!containsSupplierLeak(text), `sau lọc không còn leak: ${input} → ${text}`);
  }
});

test("filterBotOutput: KHÔNG động vào văn bản sạch", () => {
  const clean = "Vé Hà Nội đi Sài Gòn từ 1.850.000đ. Anh mua đi để giữ giá tốt nhé!";
  const { text, leaked } = filterBotOutput(clean);
  assert.equal(leaked, false);
  assert.equal(text, clean); // "mua đi" (hãy mua) KHÔNG bị che
});

test("containsSupplierLeak: dò được cả bản không dấu", () => {
  assert.equal(containsSupplierLeak("nam thanh"), true);
  assert.equal(containsSupplierLeak("NAM THÀNH"), true);
  assert.equal(containsSupplierLeak("MuaDi"), true);
  assert.equal(containsSupplierLeak("vé máy bay giá rẻ"), false);
  assert.equal(containsSupplierLeak("anh mua đi nhé"), false);
});
