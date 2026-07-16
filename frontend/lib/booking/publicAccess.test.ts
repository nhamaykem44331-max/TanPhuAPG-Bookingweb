import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  bookingPaymentPath,
  createBookingPublicAccessToken,
  verifyBookingPublicAccessToken,
} from "./publicAccess";

const previousSecret = process.env.BOOKING_PUBLIC_ACCESS_SECRET;

before(() => {
  process.env.BOOKING_PUBLIC_ACCESS_SECRET = "test-only-secret";
});

after(() => {
  if (previousSecret === undefined) delete process.env.BOOKING_PUBLIC_ACCESS_SECRET;
  else process.env.BOOKING_PUBLIC_ACCESS_SECRET = previousSecret;
});

describe("booking public access", () => {
  const now = new Date("2026-07-16T08:00:00.000Z");

  it("accepts a scoped token before expiry", () => {
    const token = createBookingPublicAccessToken("booking-1", { now, ttlSeconds: 60 });
    assert.equal(verifyBookingPublicAccessToken("booking-1", token, new Date(now.getTime() + 59_000)), true);
  });

  it("rejects another booking, a tampered token, and an expired token", () => {
    const token = createBookingPublicAccessToken("booking-1", { now, ttlSeconds: 60 });
    assert.equal(verifyBookingPublicAccessToken("booking-2", token, now), false);
    assert.equal(verifyBookingPublicAccessToken("booking-1", `${token}x`, now), false);
    assert.equal(verifyBookingPublicAccessToken("booking-1", token, new Date(now.getTime() + 61_000)), false);
  });

  it("builds a payment URL that preserves the token", () => {
    assert.equal(bookingPaymentPath("booking-1", "123.sig", true), "/booking/payment/booking-1?token=123.sig&later=1");
  });
});
