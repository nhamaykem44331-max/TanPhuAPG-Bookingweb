import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { prisma } from "@/lib/db";

const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
const LOGIN_RATE_LIMIT_WINDOW_MS = LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

type RateLimitSource = "upstash" | "db";

export interface LoginRateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
  source: RateLimitSource;
}

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, `${LOGIN_RATE_LIMIT_WINDOW_MINUTES} m`),
      analytics: false,
      prefix: "admin-login",
    })
  : null;

let hasWarnedDbFallback = false;

function warnDbFallback(): void {
  if (hasWarnedDbFallback) {
    return;
  }

  hasWarnedDbFallback = true;
  console.warn("[admin] Upstash Redis chưa được cấu hình. Đang fallback rate limit về bảng RateLimitHit.");
}

async function cleanupExpiredHits(windowStart: Date): Promise<void> {
  await prisma.rateLimitHit.deleteMany({
    where: {
      hitAt: { lt: windowStart },
    },
  });
}

async function getDbRateLimitStatus(bucketKey: string): Promise<LoginRateLimitStatus> {
  const now = Date.now();
  const windowStart = new Date(now - LOGIN_RATE_LIMIT_WINDOW_MS);
  await cleanupExpiredHits(windowStart);

  const hits = await prisma.rateLimitHit.findMany({
    where: {
      bucketKey,
      hitAt: { gte: windowStart },
    },
    orderBy: {
      hitAt: "asc",
    },
    select: {
      hitAt: true,
    },
  });

  const firstHitAt = hits[0]?.hitAt;
  const resetAt = firstHitAt ? new Date(firstHitAt.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS) : new Date(now);
  const allowed = hits.length < LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  const remaining = Math.max(0, LOGIN_RATE_LIMIT_MAX_ATTEMPTS - hits.length);
  const retryAfterSeconds = allowed ? 0 : Math.max(0, Math.ceil((resetAt.getTime() - now) / 1000));

  return {
    allowed,
    remaining,
    resetAt,
    retryAfterSeconds,
    source: "db",
  };
}

export async function getLoginRateLimitStatus(bucketKey: string): Promise<LoginRateLimitStatus> {
  if (ratelimit) {
    const remaining = await ratelimit.getRemaining(bucketKey);
    const resetAt = new Date(remaining.reset);

    return {
      allowed: remaining.remaining > 0,
      remaining: remaining.remaining,
      resetAt,
      retryAfterSeconds: remaining.remaining > 0 ? 0 : Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
      source: "upstash",
    };
  }

  warnDbFallback();
  return getDbRateLimitStatus(bucketKey);
}

export async function recordLoginFailure(bucketKey: string): Promise<void> {
  if (ratelimit) {
    await ratelimit.limit(bucketKey);
    return;
  }

  warnDbFallback();

  await prisma.rateLimitHit.create({
    data: {
      bucketKey,
    },
  });
}
