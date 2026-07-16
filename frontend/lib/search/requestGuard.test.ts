import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  checkSearchRateLimit,
  clearSearchRateLimitForTests,
  normalizeSearchPayload,
  validateSearchPayload,
} from "./requestGuard";

afterEach(() => {
  clearSearchRateLimitForTests();
  delete process.env.SEARCH_RATE_LIMIT_MAX;
  delete process.env.SEARCH_RATE_LIMIT_WINDOW_MS;
});

describe("search request guard", () => {
  it("applies full roundtrip and passenger validation to every search transport", () => {
    const body = normalizeSearchPayload({
      from: "han",
      to: "sgn",
      date: "2026-08-01",
      tripType: "roundtrip",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "economy",
    });
    assert.equal(validateSearchPayload(body, "2026-07-16"), "Chuyến khứ hồi phải có ngày về");
  });

  it("rejects an invalid party size", () => {
    const body = normalizeSearchPayload({
      from: "HAN", to: "SGN", date: "2026-08-01", tripType: "oneway",
      adults: 8, children: 2, infants: 0, cabin: "economy",
    });
    assert.equal(validateSearchPayload(body, "2026-07-16"), "Tổng số hành khách tối đa 9");
  });

  it("shares one rate-limit bucket across callers", () => {
    process.env.SEARCH_RATE_LIMIT_MAX = "2";
    process.env.SEARCH_RATE_LIMIT_WINDOW_MS = "60000";
    assert.equal(checkSearchRateLimit("1.2.3.4", 1_000).ok, true);
    assert.equal(checkSearchRateLimit("1.2.3.4", 1_001).ok, true);
    assert.equal(checkSearchRateLimit("1.2.3.4", 1_002).ok, false);
  });
});
