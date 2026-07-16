import type { NextRequest } from "next/server";

import type { SearchPayload } from "@/lib/types";
import { isValidDate, isValidIATA } from "@/lib/utils";

const buckets = new Map<string, { count: number; resetAt: number }>();
let calls = 0;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function localTodayYmd(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeSearchPayload(body: Partial<SearchPayload>): SearchPayload {
  return {
    ...body,
    from: String(body.from || "").toUpperCase(),
    to: String(body.to || "").toUpperCase(),
    date: String(body.date || ""),
    returnDate: body.returnDate ? String(body.returnDate) : undefined,
    adults: Number(body.adults ?? 1),
    children: Number(body.children ?? 0),
    infants: Number(body.infants ?? 0),
    cabin: body.cabin || "economy",
    tripType: body.tripType || "oneway",
  };
}

export function validateSearchPayload(body: SearchPayload, today = localTodayYmd()): string | null {
  if (!body.from || !isValidIATA(body.from)) return "Mã sân bay đi không hợp lệ (VD: HAN)";
  if (!body.to || !isValidIATA(body.to)) return "Mã sân bay đến không hợp lệ (VD: SGN)";
  if (body.from === body.to) return "Điểm đi và điểm đến không được giống nhau";
  if (!body.date || !isValidDate(body.date)) return "Ngày đi không hợp lệ (YYYY-MM-DD)";
  if (body.date < today) return "Ngày đi phải từ hôm nay trở đi";
  if (body.tripType === "roundtrip" && !body.returnDate) return "Chuyến khứ hồi phải có ngày về";
  if (body.returnDate && !isValidDate(body.returnDate)) return "Ngày về không hợp lệ";
  if (body.returnDate && body.returnDate < today) return "Ngày về phải từ hôm nay trở đi";
  if (body.returnDate && body.returnDate < body.date) return "Ngày về phải sau ngày đi";
  if (body.adults < 1 || body.adults > 9) return "Số người lớn phải từ 1-9";
  if (body.children < 0 || body.children > 9) return "Số trẻ em phải từ 0-9";
  if (body.infants < 0 || body.infants > 4) return "Số em bé phải từ 0-4";
  if (body.infants > body.adults) return "Số em bé không được vượt quá số người lớn";
  if (body.adults + body.children + body.infants > 9) return "Tổng số hành khách tối đa 9";
  if (!["economy", "premium", "business", "first"].includes(body.cabin)) return "Hạng vé không hợp lệ";
  return null;
}

export function searchClientIp(req: Pick<NextRequest, "headers">): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "local";
}

export function checkSearchRateLimit(ip: string, now = Date.now()): {
  ok: boolean;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
} {
  const defaultLimit = process.env.NODE_ENV === "development" ? 500 : 120;
  const defaultWindow = process.env.NODE_ENV === "development" ? 60_000 : 3_600_000;
  const limit = envNumber("SEARCH_RATE_LIMIT_MAX", defaultLimit);
  const windowMs = envNumber("SEARCH_RATE_LIMIT_WINDOW_MS", defaultWindow);
  if (process.env.SEARCH_RATE_LIMIT_DISABLED === "true") {
    return { ok: true, retryAfterSeconds: 0, limit, windowSeconds: Math.ceil(windowMs / 1000) };
  }

  const entry = buckets.get(ip);
  if (!entry || now > entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0, limit, windowSeconds: Math.ceil(windowMs / 1000) };
  }

  entry.count += 1;
  if (++calls % 500 === 0) {
    for (const [key, value] of buckets) if (now > value.resetAt) buckets.delete(key);
  }

  return {
    ok: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    limit,
    windowSeconds: Math.ceil(windowMs / 1000),
  };
}

export function clearSearchRateLimitForTests() {
  buckets.clear();
  calls = 0;
}
