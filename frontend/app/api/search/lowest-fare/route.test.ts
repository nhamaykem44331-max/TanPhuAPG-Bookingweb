import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Session } from "next-auth";

import { handleLowestFareApiRequest } from "./handler";
import type { NamThanhLowestFareResponse } from "@/lib/namthanh";

function mockSession(id = "user-1"): Session {
  return {
    expires: "2026-05-01T00:00:00.000Z",
    user: {
      id,
      email: "admin@tanphuapg.com",
      fullName: "Super Admin",
      role: "SUPER_ADMIN",
      active: true,
    },
  };
}

function mockLowestFare(): NamThanhLowestFareResponse {
  return {
    route: { origin: "HAN", destination: "SGN" },
    depart: {
      "4-2026": [
        { day: 26, month: 4, year: 2026, fareAmount: 1790000, fareDisplay: "1.790.000 đ" },
      ],
    },
    return: {},
    currency: "VND",
    cachedAt: "2026-04-25T01:24:59.611Z",
    ttlSeconds: 300,
  };
}

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/search/lowest-fare", () => {
  it("vẫn cho qua khi chưa đăng nhập (homepage public) và rate limit theo IP", async () => {
    const buckets = new Map<string, { count: number; resetAt: number }>();
    const response = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HAN&to=SGN"), {
      getSession: async () => null,
      getLowestFare: async () => mockLowestFare(),
      now: () => Date.parse("2026-04-25T00:00:00.000Z"),
      buckets,
      rateLimit: { max: 5, windowMs: 60_000 },
    });
    const body = await json(response);

    assert.equal(response.status, 200);
    assert.deepEqual(body.route, { origin: "HAN", destination: "SGN" });
    // Phải tạo bucket dưới key IP, không dưới key user.id
    assert.ok([...buckets.keys()].some((key) => key.startsWith("ip:")));
  });

  it("trả lowest fare khi session hợp lệ và IATA đúng", async () => {
    let calledWith: { origin: string; destination: string } | null = null;
    const response = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=han&to=sgn"), {
      getSession: async () => mockSession(),
      now: () => Date.parse("2026-04-25T00:00:00.000Z"),
      getLowestFare: async (params) => {
        calledWith = params;
        return mockLowestFare();
      },
    });
    const body = await json(response);

    assert.equal(response.status, 200);
    assert.deepEqual(calledWith, { origin: "HAN", destination: "SGN" });
    assert.deepEqual(body.route, { origin: "HAN", destination: "SGN" });
    assert.ok(body.depart);
    assert.equal(body.serverNow, "2026-04-25T00:00:00.000Z");
  });

  it("trả 400 khi IATA sai", async () => {
    const response = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HA&to=SGN"), {
      getSession: async () => mockSession(),
    });
    const body = await json(response);

    assert.equal(response.status, 400);
    assert.equal(body.error, "INVALID_IATA");
  });

  it("trả 502 khi backend Nam Thanh lỗi", async () => {
    const response = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HAN&to=SGN"), {
      getSession: async () => mockSession(),
      getLowestFare: async () => {
        throw new Error("backend down");
      },
    });
    const body = await json(response);

    assert.equal(response.status, 502);
    assert.equal(body.error, "BACKEND_UNAVAILABLE");
  });

  it("trả 429 khi vượt rate limit", async () => {
    const buckets = new Map<string, { count: number; resetAt: number }>();
    const deps = {
      getSession: async () => mockSession("rate-user"),
      getLowestFare: async () => mockLowestFare(),
      now: () => 1_000,
      buckets,
      rateLimit: { max: 2, windowMs: 60_000 },
    };

    const first = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HAN&to=SGN"), deps);
    const second = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HAN&to=SGN"), deps);
    const third = await handleLowestFareApiRequest(request("/api/search/lowest-fare?from=HAN&to=SGN"), deps);
    const body = await json(third);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.equal(body.error, "RATE_LIMITED");
  });
});
