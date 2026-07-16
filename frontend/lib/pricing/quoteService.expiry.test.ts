import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fallbackQuoteExpiry } from "./quoteService";

describe("fallbackQuoteExpiry", () => {
  it("uses a short operational TTL instead of the latest flight departure", () => {
    const now = new Date("2026-07-16T08:00:00.000Z");
    const expiry = fallbackQuoteExpiry([
      { departureAt: "2026-08-16T08:00:00.000Z" },
      { departureAt: "2026-08-20T08:00:00.000Z" },
    ], now, 10);
    assert.equal(expiry, "2026-07-16T08:10:00.000Z");
  });

  it("never extends past a departure that is sooner than the fallback TTL", () => {
    const now = new Date("2026-07-16T08:00:00.000Z");
    assert.equal(
      fallbackQuoteExpiry([{ departureAt: "2026-07-16T08:05:00.000Z" }], now, 10),
      "2026-07-16T08:05:00.000Z",
    );
  });
});
