import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNamThanhLowestFare, type NamThanhLowestFareResponse } from "@/lib/namthanh";
import { computeAirlineAgnosticMarkup, loadMarkupContext } from "@/lib/pricing/searchMarkup";
import { isValidIATA } from "@/lib/utils";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface LowestFareRouteDeps {
  getSession?: () => Promise<Session | null>;
  getLowestFare?: (params: { origin: string; destination: string }) => Promise<NamThanhLowestFareResponse>;
  now?: () => number;
  buckets?: Map<string, RateLimitBucket>;
  rateLimit?: RateLimitConfig;
}

export const lowestFareRateLimitBuckets = new Map<string, RateLimitBucket>();

function rateLimitConfig(): RateLimitConfig {
  if (process.env.NODE_ENV === "development") {
    return { max: 200, windowMs: 60_000 };
  }

  return { max: 30, windowMs: 3_600_000 };
}

function checkRateLimit(
  key: string,
  buckets: Map<string, RateLimitBucket>,
  config: RateLimitConfig,
  now: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true };
  }

  current.count += 1;

  if (current.count <= config.max) {
    return { ok: true };
  }

  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function validationError(status = 400) {
  return NextResponse.json({ error: "INVALID_IATA" }, { status });
}

function clientIpKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0]?.trim() || "anon"}`;
  }

  const real = request.headers.get("x-real-ip");
  if (real) {
    return `ip:${real.trim()}`;
  }

  return "ip:anon";
}

export async function handleLowestFareApiRequest(
  request: Request,
  deps: LowestFareRouteDeps = {},
): Promise<NextResponse> {
  // Endpoint dùng cho cả homepage public lẫn /search nên KHÔNG bắt buộc auth.
  // Nếu có session → rate limit theo user.id; nếu không → rate limit theo IP.
  const session = deps.getSession ? await deps.getSession() : await auth();

  const url = new URL(request.url);
  const from = String(url.searchParams.get("from") || "").trim().toUpperCase();
  const to = String(url.searchParams.get("to") || "").trim().toUpperCase();

  if (!isValidIATA(from) || !isValidIATA(to)) {
    return validationError();
  }

  const now = deps.now ? deps.now() : Date.now();
  const buckets = deps.buckets || lowestFareRateLimitBuckets;
  const limit = deps.rateLimit || rateLimitConfig();
  const rateLimitKey = session?.user?.id ?? clientIpKey(request);
  const rate = checkRateLimit(rateLimitKey, buckets, limit, now);

  if (!rate.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterSeconds: rate.retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const provider = deps.getLowestFare || getNamThanhLowestFare;
    const data = await provider({ origin: from, destination: to });

    // Áp markup airline-agnostic (chỉ rule có airline=null) — vì lowest-fare
    // không biết hãng cụ thể, chỉ áp được rule chung domestic/international
    let depart = data.depart;
    let returnLeg = data.return;
    try {
      const ctx = await loadMarkupContext("web", "ADT");
      const buildMarkupedBucket = async (
        bucket: typeof data.depart,
        legFrom: string,
        legTo: string,
      ): Promise<typeof data.depart> => {
        const out: typeof data.depart = {};
        for (const [monthKey, days] of Object.entries(bucket || {})) {
          const updated = await Promise.all(
            (days || []).map(async (day) => {
              const sellPrice = await computeAirlineAgnosticMarkup(day.fareAmount, legFrom, legTo, ctx);
              if (!Number.isFinite(sellPrice) || sellPrice <= 0 || sellPrice === day.fareAmount) {
                return day;
              }
              return {
                ...day,
                fareAmount: sellPrice,
                fareDisplay: `${sellPrice.toLocaleString("vi-VN")} đ`,
              };
            }),
          );
          out[monthKey] = updated;
        }
        return out;
      };
      depart = await buildMarkupedBucket(data.depart, from, to);
      returnLeg = await buildMarkupedBucket(data.return, to, from);
    } catch (markupError) {
      console.error("[lowest-fare] Markup apply failed, returning net prices:", markupError);
    }

    return NextResponse.json({
      route: data.route,
      depart,
      return: returnLeg,
      currency: data.currency,
      cachedAt: data.cachedAt,
      ttlSeconds: data.ttlSeconds,
      serverNow: new Date(now).toISOString(),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "BACKEND_UNAVAILABLE",
        detail: process.env.NODE_ENV === "production" ? undefined : detail,
      },
      { status: 502 },
    );
  }
}
