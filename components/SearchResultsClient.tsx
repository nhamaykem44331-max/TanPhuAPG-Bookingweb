"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import ContactModal from "@/components/ContactModal";
import FilterSidebar from "@/components/FilterSidebar";
import FlightCard from "@/components/FlightCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import SortBar from "@/components/SortBar";
import type { DateStripProps } from "@/components/search/DateStrip";
import { toISO } from "@/lib/date";
import type { Cabin, FlightResult, RoundtripPairOption, SearchPayload, SearchResponse } from "@/lib/types";

interface SearchParamsLike {
  get(name: string): string | null;
  toString(): string;
}

interface SearchResultsContentProps {
  searchParams: SearchParamsLike;
  replace: (href: string) => void;
  DateStripComponent?: ComponentType<DateStripProps>;
}

const DynamicDateStrip = dynamic(() => import("@/components/search/DateStrip"), {
  loading: () => <DateStripSkeleton />,
  ssr: false,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateParam(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  try {
    return toISO(value);
  } catch {
    return fallback;
  }
}

function sortFlights(items: FlightResult[], mode: string) {
  const arr = [...items];

  if (mode === "fastest") {
    arr.sort((a, b) => a.duration - b.duration);
  } else if (mode === "earliest") {
    arr.sort((a, b) => +new Date(a.departure.time) - +new Date(b.departure.time));
  } else {
    arr.sort((a, b) => a.price.amount - b.price.amount);
  }

  return arr;
}

function buildPayload(searchParams: SearchParamsLike): SearchPayload {
  const defaultDate = todayISO();
  const tripType = (searchParams.get("tripType") as "oneway" | "roundtrip") || "oneway";
  const date = normalizeDateParam(searchParams.get("date"), defaultDate);
  const rawReturnDate = searchParams.get("returnDate");

  return {
    from: searchParams.get("from") || "HAN",
    to: searchParams.get("to") || "SGN",
    date,
    returnDate: rawReturnDate ? normalizeDateParam(rawReturnDate, date) : undefined,
    adults: Number(searchParams.get("adults") || 1),
    children: Number(searchParams.get("children") || 0),
    infants: Number(searchParams.get("infants") || 0),
    cabin: (searchParams.get("cabin") as Cabin) || "economy",
    tripType,
  };
}

function buildSearchUrl(searchParams: SearchParamsLike, payload: SearchPayload, updates: Partial<Pick<SearchPayload, "date" | "returnDate">>) {
  const next = new URLSearchParams(searchParams.toString());

  next.set("from", payload.from);
  next.set("to", payload.to);
  next.set("date", updates.date || payload.date);
  next.set("adults", String(payload.adults));
  next.set("children", String(payload.children));
  next.set("infants", String(payload.infants));
  next.set("cabin", payload.cabin);
  next.set("tripType", payload.tripType);

  const returnDate = updates.returnDate ?? payload.returnDate;

  if (payload.tripType === "roundtrip" && returnDate) {
    next.set("returnDate", returnDate);
  } else {
    next.delete("returnDate");
  }

  return `/search?${next.toString()}`;
}

function DateStripSkeleton() {
  return (
    <div className="grid grid-cols-3 border-t border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          aria-hidden="true"
          className={`min-h-[76px] border-r border-[var(--apg-border-default)] bg-white p-3 last:border-r-0 ${
            index === 0 ? "hidden lg:block" : index === 4 ? "hidden md:block" : ""
          }`}
          key={index}
        >
          <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-5 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function RouteHeaderCard({
  children,
  date,
  destination,
  direction,
  filteredCount,
  origin,
  totalCount,
}: {
  children: ReactNode;
  date: string;
  destination: string;
  direction: "depart" | "return";
  filteredCount: number;
  origin: string;
  totalCount: number;
}) {
  const label = direction === "depart" ? "Chiều đi" : "Chiều về";

  return (
    <section className="overflow-hidden rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)]">
      <div className="flex items-center justify-between gap-4 bg-[var(--apg-aviation-navy)] px-4 py-3 text-white">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--apg-brand-gold)]">
            {label}
          </div>
          <div className="mt-1 text-xl font-extrabold tracking-[-0.03em]">
            {origin} → {destination}
          </div>
          <div className="mt-1 text-xs text-white/78">{date}</div>
        </div>
        <div className="apg-mono shrink-0 text-sm font-bold">
          {filteredCount}/{totalCount}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Streaming search hook ────────────────────────────────────────────────────

interface StreamProgress {
  completed: number;
  total: number;
}

interface UseStreamingSearchResult {
  data: SearchResponse | null;
  loading: boolean;
  streamDone: boolean;
  streamProgress: StreamProgress;
  error: string;
}

function mergeFlights(existing: FlightResult[], incoming: FlightResult[]): FlightResult[] {
  const seen = new Set(existing.map((f) => f.id));
  const added = incoming.filter((f) => !seen.has(f.id));
  return added.length ? [...existing, ...added].sort((a, b) => a.price.amount - b.price.amount) : existing;
}

function mergePairs(existing: RoundtripPairOption[], incoming: RoundtripPairOption[]): RoundtripPairOption[] {
  const seen = new Set(existing.map((p) => p.id));
  const added = incoming.filter((p) => !seen.has(p.id));
  return added.length ? [...existing, ...added].sort((a, b) => a.totalAmount - b.totalAmount) : existing;
}

function useStreamingSearch(payload: SearchPayload, payloadKey: string): UseStreamingSearchResult {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamDone, setStreamDone] = useState(false);
  const [streamProgress, setStreamProgress] = useState<StreamProgress>({ completed: 0, total: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const runStream = useCallback(async (p: SearchPayload, signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setStreamDone(false);
    setStreamProgress({ completed: 0, total: 0 });
    setData(null);

    try {
      const res = await fetch("/api/search/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
        signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Lỗi tìm kiếm: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamNotSupported = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(5).trim());

            // Error event from server
            if (eventLine?.includes("error") || event.error) {
              if (event.error === "STREAM_NOT_SUPPORTED") {
                streamNotSupported = true;
              } else {
                throw new Error(event.error || "Lỗi streaming");
              }
              break;
            }

            if (event.type === "session") {
              setStreamProgress({ completed: 0, total: event.airlines?.length ?? 0 });
              continue;
            }

            if (event.type === "airline_result") {
              setStreamProgress({ completed: event.completedCount ?? 0, total: event.totalCount ?? 0 });
              setLoading(false);

              const incoming = (event.results ?? []) as FlightResult[];
              const incomingDep = (event.departureResults ?? []) as FlightResult[];
              const incomingRet = (event.returnResults ?? []) as FlightResult[];

              setData((prev) => {
                const base = prev ?? {
                  searchId: `stream_${Date.now()}`,
                  results: [],
                  departureResults: [],
                  returnResults: [],
                  pairOptions: [],
                  metadata: { totalResults: 0, departureCount: 0, returnCount: 0, pairCount: 0, cached: false, sourceUsed: "namthanh" as const },
                };
                const results = mergeFlights(base.results, incoming);
                const departureResults = mergeFlights(base.departureResults ?? [], incomingDep);
                const returnResults = mergeFlights(base.returnResults ?? [], incomingRet);
                return {
                  ...base,
                  results,
                  departureResults,
                  returnResults,
                  metadata: {
                    ...base.metadata,
                    totalResults: results.length,
                    departureCount: departureResults.length,
                    returnCount: returnResults.length,
                  },
                };
              });
              continue;
            }

            if (event.type === "airline_error") {
              setStreamProgress({ completed: event.completedCount ?? 0, total: event.totalCount ?? 0 });
              continue;
            }

            if (event.type === "done") {
              setStreamDone(true);
              setLoading(false);
              break;
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Lỗi streaming") continue;
            throw parseErr;
          }
        }

        if (streamNotSupported) break;
      }

      // Fallback: streaming endpoint not deployed → use regular search
      if (streamNotSupported) {
        const fallback = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
          signal,
        });
        const json = await fallback.json();
        if (!fallback.ok) throw new Error(json.error || "Lỗi tìm kiếm");
        setData(json);
        setStreamDone(true);
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Đã có lỗi");
      setLoading(false);
      setStreamDone(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    runStream(payload, controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  return { data, loading, streamDone, streamProgress, error };
}

// ─────────────────────────────────────────────────────────────────────────────

export function SearchResultsContent({
  searchParams,
  replace,
  DateStripComponent = DynamicDateStrip,
}: SearchResultsContentProps) {
  const searchParamsKey = searchParams.toString();
  const payload = useMemo(() => buildPayload(searchParams), [searchParamsKey, searchParams]);
  const [sort, setSort] = useState("price");
  const [stopFilter, setStopFilter] = useState(new Set<string>(["nonstop", "one"]));
  const [airlineFilter, setAirlineFilter] = useState(new Set<string>());
  const [openContact, setOpenContact] = useState(false);

  const { data, loading, streamDone, streamProgress, error } = useStreamingSearch(payload, searchParamsKey);

  // Auto-populate airline filter as results stream in
  useEffect(() => {
    if (data?.results && data.results.length > 0) {
      setAirlineFilter((prev) => {
        const next = new Set(prev);
        data.results.forEach((f) => next.add(f.airline));
        return next;
      });
    }
  }, [data?.results?.length]);

  const filtered = useMemo(() => {
    const base = data?.results || [];
    const byStop = base.filter((flight) => {
      if (flight.stops === 0 && stopFilter.has("nonstop")) return true;
      if (flight.stops === 1 && stopFilter.has("one")) return true;
      if (flight.stops >= 2 && stopFilter.has("two")) return true;
      return false;
    });
    const byAirline = airlineFilter.size > 0
      ? byStop.filter((flight) => airlineFilter.has(flight.airline))
      : byStop;

    return sortFlights(byAirline, sort);
  }, [airlineFilter, data, sort, stopFilter]);

  const totalCount = data?.metadata?.totalResults ?? data?.results.length ?? 0;
  const departureTotal = data?.metadata?.departureCount ?? data?.departureResults?.length ?? totalCount;
  const returnTotal = data?.metadata?.returnCount ?? data?.returnResults?.length ?? 0;

  function replaceDate(param: "date" | "returnDate", nextDate: string) {
    replace(buildSearchUrl(searchParams, payload, { [param]: nextDate }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 rounded-2xl border border-[var(--apg-border-default)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">
              Hành trình đang tìm
            </div>
            <div className="mt-1 text-base font-extrabold text-[var(--apg-aviation-navy-deep)]">
              {payload.from} → {payload.to} · {payload.date} · {payload.adults} người lớn
            </div>
          </div>
          <button className="text-sm font-semibold text-brand underline" onClick={() => history.back()} type="button">
            Sửa
          </button>
        </div>
      </div>

      {/* Loading skeleton — only when no results yet */}
      {loading && !data && <LoadingSkeleton />}

      {/* Streaming progress bar — shown while loading and results are coming in */}
      {!streamDone && streamProgress.total > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--apg-border-default)] bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-[var(--apg-text-secondary)]">
            <span>
              Đang tìm kiếm{" "}
              <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">
                {payload.from} → {payload.to}
              </span>
              …
            </span>
            <span className="font-mono text-xs">
              {streamProgress.completed}/{streamProgress.total} hãng
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{
                width: streamProgress.total > 0
                  ? `${Math.round((streamProgress.completed / streamProgress.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          {data && data.results.length > 0 && (
            <p className="mt-1 text-xs text-[var(--apg-text-secondary)]">
              Đã tìm được {data.results.length} chuyến bay, đang tải thêm…
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}{" "}
          <button className="underline" onClick={() => location.reload()} type="button">
            Thử lại
          </button>
        </div>
      )}

      {/* Show results as soon as first flights arrive, don't wait for streamDone */}
      {!error && data && (
        <div className="space-y-4">
          <RouteHeaderCard
            date={payload.date}
            destination={payload.to}
            direction="depart"
            filteredCount={filtered.length}
            origin={payload.from}
            totalCount={departureTotal}
          >
            <DateStripComponent
              destination={payload.to}
              direction="depart"
              origin={payload.from}
              selectedDate={toISO(payload.date)}
              onSelect={(nextDate) => replaceDate("date", nextDate)}
            />
          </RouteHeaderCard>

          {payload.tripType === "roundtrip" && payload.returnDate ? (
            <RouteHeaderCard
              date={payload.returnDate}
              destination={payload.from}
              direction="return"
              filteredCount={returnTotal}
              origin={payload.to}
              totalCount={returnTotal}
            >
              <DateStripComponent
                destination={payload.from}
                direction="return"
                origin={payload.to}
                selectedDate={toISO(payload.returnDate)}
                onSelect={(nextDate) => replaceDate("returnDate", nextDate)}
              />
            </RouteHeaderCard>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[250px_1fr]">
            <FilterSidebar
              airlineFilter={airlineFilter}
              flights={data.results}
              setAirlineFilter={setAirlineFilter}
              setStopFilter={setStopFilter}
              stopFilter={stopFilter}
            />
            <div>
              <SortBar setSort={setSort} sort={sort} />
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  streamDone ? (
                    <div className="rounded-2xl border bg-white p-4">
                      Không có kết quả phù hợp. Hãy đổi ngày hoặc điểm đến.
                    </div>
                  ) : (
                    <LoadingSkeleton />
                  )
                ) : (
                  filtered.map((flight) => <FlightCard f={flight} key={flight.id} onContact={() => setOpenContact(true)} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ContactModal onClose={() => setOpenContact(false)} open={openContact} />
    </main>
  );
}

export default function SearchResultsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  return <SearchResultsContent replace={router.replace} searchParams={searchParams} />;
}
