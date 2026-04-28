"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import ContactModal from "@/components/ContactModal";
import FilterSidebar from "@/components/FilterSidebar";
import FlightCard from "@/components/FlightCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import SortBar from "@/components/SortBar";
import type { DateStripProps } from "@/components/search/DateStrip";
import { toISO } from "@/lib/date";
import type { Cabin, FlightResult, SearchPayload, SearchResponse } from "@/lib/types";

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

export function SearchResultsContent({
  searchParams,
  replace,
  DateStripComponent = DynamicDateStrip,
}: SearchResultsContentProps) {
  const searchParamsKey = searchParams.toString();
  const payload = useMemo(() => buildPayload(searchParams), [searchParamsKey, searchParams]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [sort, setSort] = useState("price");
  const [stopFilter, setStopFilter] = useState(new Set<string>(["nonstop", "one"]));
  const [airlineFilter, setAirlineFilter] = useState(new Set<string>());
  const [openContact, setOpenContact] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/search", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Lỗi tìm kiếm");
        }

        if (!cancelled) {
          setData(json);
          setAirlineFilter(new Set(json.results.map((flight: FlightResult) => flight.airline)));
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Đã có lỗi");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload, searchParamsKey]);

  const filtered = useMemo(() => {
    const base = data?.results || [];
    const byStop = base.filter((flight) => {
      if (flight.stops === 0 && stopFilter.has("nonstop")) return true;
      if (flight.stops === 1 && stopFilter.has("one")) return true;
      if (flight.stops >= 2 && stopFilter.has("two")) return true;
      return false;
    });
    const byAirline = byStop.filter((flight) => airlineFilter.has(flight.airline));

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

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}{" "}
          <button className="underline" onClick={() => location.reload()} type="button">
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && data && (
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
                  <div className="rounded-2xl border bg-white p-4">
                    Không có kết quả phù hợp. Hãy đổi ngày hoặc điểm đến.
                  </div>
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
