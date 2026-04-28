"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type { NamThanhLowestFareResponse } from "@/lib/namthanh";

export interface DateStripProps {
  origin: string;
  destination: string;
  selectedDate: string;
  direction: "depart" | "return";
  onSelect: (date: string) => void;
  className?: string;
}

interface DateStripDay {
  iso: string;
  weekday: string;
  dayMonth: string;
  fareAmount: number | null;
  fareDisplay: string | null;
  isSelected: boolean;
  isBest: boolean;
  isPast: boolean;
}

const MS_PER_DAY = 86_400_000;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  timeZone: VIETNAM_TIME_ZONE,
});
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: VIETNAM_TIME_ZONE,
});
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: VIETNAM_TIME_ZONE,
});
const FULL_MONEY_FORMATTER = new Intl.NumberFormat("vi-VN");
const routeCache = new Map<string, NamThanhLowestFareResponse>();

export function clearDateStripCacheForTests() {
  routeCache.clear();
}

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftISODate(iso: string, amount: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + amount);

  return toISODate(date);
}

function fareLookupKey(iso: string): { bucket: string; day: number } {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();

  return { bucket: `${month}-${year}`, day };
}

function normalizeWeekday(value: string): string {
  const normalized = value.replace(".", "").trim();

  if (normalized.toLowerCase() === "cn") {
    return "CN";
  }

  return normalized.toUpperCase();
}

export function getTodayInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function isBeforeISO(left: string, right: string): boolean {
  return parseISODate(left).getTime() < parseISODate(right).getTime();
}

function formatCompactFare(amount: number): string {
  return `${Math.round(amount / 1000).toLocaleString("vi-VN")}K`;
}

function formatFullFare(amount: number): string {
  return `${FULL_MONEY_FORMATTER.format(amount)} đồng`;
}

function findFare(
  data: NamThanhLowestFareResponse | null,
  direction: "depart" | "return",
  iso: string,
): { amount: number | null; display: string | null } {
  if (!data) {
    return { amount: null, display: null };
  }

  const { bucket, day } = fareLookupKey(iso);
  const bucketRecords =
    data[direction]?.[bucket] ??
    data.depart?.[bucket] ??
    data.return?.[bucket] ??
    [];
  const record = bucketRecords.find((item) => item.day === day);

  return {
    amount: typeof record?.fareAmount === "number" ? record.fareAmount : null,
    display: record?.fareDisplay || null,
  };
}

function buildDays(
  data: NamThanhLowestFareResponse | null,
  direction: "depart" | "return",
  selectedDate: string,
  today: string,
): DateStripDay[] {
  const days = [-2, -1, 0, 1, 2].map((offset) => {
    const iso = shiftISODate(selectedDate, offset);
    const date = parseISODate(iso);
    const fare = findFare(data, direction, iso);

    return {
      iso,
      weekday: normalizeWeekday(WEEKDAY_FORMATTER.format(date)),
      dayMonth: DAY_MONTH_FORMATTER.format(date),
      fareAmount: fare.amount,
      fareDisplay: fare.display,
      isSelected: iso === selectedDate,
      isBest: false,
      isPast: isBeforeISO(iso, today),
    };
  });
  const fares = days
    .map((day) => day.fareAmount)
    .filter((amount): amount is number => typeof amount === "number");
  const minFare = fares.length > 0 ? Math.min(...fares) : null;
  const maxFare = fares.length > 0 ? Math.max(...fares) : null;
  // Chỉ đánh dấu "best" khi có chênh lệch thực sự (≥ 50K).
  // Giá ngang nhau → không highlight ai cả, tránh "Giá tốt" spam mất ý nghĩa.
  const hasMeaningfulSpread =
    minFare !== null && maxFare !== null && maxFare - minFare >= 50_000;

  return days.map((day) => ({
    ...day,
    isBest: hasMeaningfulSpread && day.fareAmount === minFare,
  }));
}

function buildAriaLabel(day: DateStripDay): string {
  const dateLabel = LONG_DATE_FORMATTER.format(parseISODate(day.iso));
  const fareLabel = day.fareAmount === null ? "chưa có giá" : `giá ${formatFullFare(day.fareAmount)}`;

  return `${dateLabel}, ${fareLabel}`;
}

export default function DateStrip({
  origin,
  destination,
  selectedDate,
  direction,
  onSelect,
  className = "",
}: DateStripProps) {
  const routeKey = `${origin.trim().toUpperCase()}-${destination.trim().toUpperCase()}`;
  const [data, setData] = useState<NamThanhLowestFareResponse | null>(() => routeCache.get(routeKey) || null);
  const [loading, setLoading] = useState(!routeCache.has(routeKey));
  const [error, setError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const today = getTodayInVietnam();

  useEffect(() => {
    const cached = retryTick === 0 ? routeCache.get(routeKey) : undefined;

    if (cached) {
      setData(cached);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetch(`/api/search/lowest-fare?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Không lấy được giá theo ngày");
        }

        return response.json() as Promise<NamThanhLowestFareResponse>;
      })
      .then((payload) => {
        routeCache.set(routeKey, payload);
        setData(payload);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError("Không lấy được giá theo ngày");
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [destination, origin, retryTick, routeKey]);

  const days = useMemo(() => buildDays(data, direction, selectedDate, today), [data, direction, selectedDate, today]);
  const previousDate = shiftISODate(selectedDate, -1);
  const previousDisabled = isBeforeISO(previousDate, today);

  function selectDate(iso: string, disabled: boolean) {
    if (disabled) {
      return;
    }

    onSelect(iso);
  }

  function moveFocus(currentIndex: number, offset: number) {
    const next = cellRefs.current[currentIndex + offset];
    next?.focus();
  }

  if (error) {
    return (
      <div
        className={`rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-4 py-3 text-sm text-[var(--apg-text-secondary)] ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Không lấy được giá theo ngày</span>
          <button
            className="rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--apg-aviation-navy)] transition hover:border-[var(--apg-brand-gold)]"
            type="button"
            onClick={() => setRetryTick((current) => current + 1)}
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={direction === "depart" ? "Giá theo ngày chiều đi" : "Giá theo ngày chiều về"}
      className={`relative flex items-stretch border-t border-[var(--apg-border-default)]/60 bg-gradient-to-b from-white/85 via-slate-50/55 to-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 ${className}`}
    >
      <button
        aria-label="Ngày trước đó"
        className="flex w-9 shrink-0 items-center justify-center text-[var(--apg-text-secondary)] opacity-60 transition hover:bg-white hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
        disabled={previousDisabled}
        type="button"
        onClick={() => selectDate(previousDate, previousDisabled)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M9 11L5 7l4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="grid flex-1 grid-cols-3 divide-x divide-[var(--apg-border-default)]/60 md:grid-cols-4 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                aria-hidden="true"
                className={`flex min-h-[56px] flex-col justify-center gap-1.5 bg-white/40 px-3 py-2 ${
                  index === 0 ? "hidden lg:flex" : index === 4 ? "hidden md:flex" : ""
                }`}
                key={index}
              >
                <div className="h-2.5 w-12 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-14 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))
          : days.map((day, index) => {
              const disabled = day.fareAmount === null || day.isPast;
              const isEdgeBefore = index === 0;
              const isEdgeAfter = index === 4;

              return (
                <button
                  aria-disabled={disabled}
                  aria-label={buildAriaLabel(day)}
                  aria-pressed={day.isSelected}
                  className={`relative flex min-h-[56px] flex-col justify-center gap-0.5 px-3 py-2 text-left transition focus:outline-none focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    isEdgeBefore ? "hidden lg:flex" : isEdgeAfter ? "hidden md:flex" : ""
                  } ${
                    day.isSelected
                      ? "bg-white shadow-[inset_0_-2px_0_var(--apg-brand-gold)]"
                      : day.isBest
                        ? "bg-gradient-to-b from-amber-50/90 via-amber-50/60 to-amber-50/30 hover:from-amber-100/90 hover:via-amber-50/70 hover:to-amber-50/40"
                        : "hover:bg-white/60"
                  }`}
                  disabled={disabled}
                  key={day.iso}
                  ref={(node) => {
                    cellRefs.current[index] = node;
                  }}
                  role="button"
                  title={day.fareAmount === null ? "Chưa có giá" : `${day.fareDisplay || formatFullFare(day.fareAmount)}`}
                  type="button"
                  onClick={() => selectDate(day.iso, disabled)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      moveFocus(index, -1);
                    }

                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      moveFocus(index, 1);
                    }
                  }}
                >
                  <div className="text-[11px] font-normal leading-none text-[var(--apg-text-secondary)]">
                    <span className="uppercase tracking-[0.06em]">{day.weekday}</span>
                    <span className="mx-1 opacity-40">·</span>
                    <span className="tracking-tight">{day.dayMonth}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {day.isBest && day.fareAmount !== null ? (
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                    ) : null}
                    <span
                      className={`text-[13px] leading-tight tabular-nums tracking-[-0.01em] ${
                        day.fareAmount === null
                          ? "font-medium text-[var(--apg-text-muted)]"
                          : day.isBest
                            ? "font-bold text-amber-600"
                            : "font-semibold text-[var(--apg-text-primary)]"
                      }`}
                    >
                      {day.fareAmount === null ? "—" : formatCompactFare(day.fareAmount)}
                    </span>
                  </div>
                </button>
              );
            })}
      </div>

      <button
        aria-label="Ngày kế tiếp"
        className="flex w-9 shrink-0 items-center justify-center text-[var(--apg-text-secondary)] opacity-60 transition hover:bg-white hover:opacity-100"
        type="button"
        onClick={() => selectDate(shiftISODate(selectedDate, 1), false)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M5 3l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </section>
  );
}
