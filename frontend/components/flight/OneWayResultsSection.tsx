"use client";

import dynamic from 'next/dynamic';
import { FilterBar, SelectedDesktopFlight, type FilterState } from '@/components/flight/FlightFilters';
import { FlightRowSkeleton, LoadMoreRowsButton, RouteMismatchNotice, type AirportLabelMap } from '@/components/flight/FlightRow';
import VirtualizedFlightRows from '@/components/flight/VirtualizedFlightRows';
import type { DateStripProps } from '@/components/search/DateStrip';
import type { FlightResult } from '@/lib/types';

function OneWayDateStripSkeleton() {
  return (
    <div className="grid min-h-[76px] grid-cols-3 overflow-hidden border-t border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          aria-hidden="true"
          className={`border-r border-[var(--apg-border-default)] bg-white p-3 last:border-r-0 ${
            index === 0 ? 'hidden lg:block' : index === 4 ? 'hidden md:block' : ''
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

const DateStrip = dynamic<DateStripProps>(() => import('@/components/search/DateStrip'), {
  loading: () => <OneWayDateStripSkeleton />,
  ssr: false,
});

export default function OneWayResultsSection({
  airportLabels,
  dailyMinPrice,
  date,
  filter,
  flightLoadMoreStep,
  fromCode,
  isDesktopViewport,
  isDomesticRoute,
  isReloading,
  onClearSelected,
  onFilterChange,
  onLoadMore,
  onSelectDate,
  onSelectFlight,
  onSortChange,
  results,
  resultsGen,
  routeMatchesResults,
  selectedFlight,
  sortMode,
  sortedFlights,
  toCode,
  visibleFlights,
}: {
  airportLabels?: AirportLabelMap;
  dailyMinPrice?: number | null;
  date: string;
  filter: FilterState;
  flightLoadMoreStep: number;
  fromCode: string;
  isDesktopViewport: boolean | null;
  isDomesticRoute: boolean;
  isReloading: boolean;
  metaSearchTime?: number;
  onClearSelected: () => void;
  onContinue: () => void;
  selectionTotal?: number;
  onFilterChange: (filter: FilterState) => void;
  onLoadMore: () => void;
  onSelectDate: (date: string) => void;
  onSelectFlight: (flight: FlightResult) => void | Promise<void>;
  onSortChange: (mode: 'price' | 'time') => void;
  results: FlightResult[];
  resultsGen: number;
  routeMatchesResults: boolean;
  selectedFlight: FlightResult | null;
  sortMode: 'price' | 'time';
  sortedFlights: FlightResult[];
  toCode: string;
  visibleFlights: FlightResult[];
}) {
  const countLabel = routeMatchesResults ? `${sortedFlights.length}/${results.length}` : '—/—';
  const remaining = sortedFlights.length - visibleFlights.length;

  const renderRows = (emptyClassName: string, maxHeightPx: number, showRouteColumn = true) => (
    <>
      <VirtualizedFlightRows
        airportLabels={airportLabels}
        btnColor="gold"
        dailyMinPrice={dailyMinPrice}
        emptyClassName={emptyClassName}
        flights={visibleFlights}
        maxHeightPx={maxHeightPx}
        resultsGen={resultsGen}
        selectedFlightId={selectedFlight?.id}
        showRouteColumn={showRouteColumn}
        onDeselect={() => onClearSelected()}
        onSelect={onSelectFlight}
      />
      <LoadMoreRowsButton remaining={remaining} step={flightLoadMoreStep} onClick={onLoadMore} />
    </>
  );

  const renderSkeletonRows = (scrollable = false) => (
    <>
      <RouteMismatchNotice />
      <div className={scrollable ? 'max-h-[60vh] overflow-auto' : undefined}>
        {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} />))}
      </div>
    </>
  );

  const navyHeader = (
    <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(120deg,#0c2740,#1a4e78)' }}>
      <div className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">Chuyến bay một chiều</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="text-[26px] font-bold tracking-[0.01em]">{fromCode} → {toCode}</div>
        <div className="apg-tabular shrink-0 text-sm font-semibold text-white/85">{countLabel}</div>
      </div>
      <div className="apg-tabular mt-1 text-xs text-white/60">{date}</div>
    </div>
  );

  return (
    <>
      {/* MOBILE */}
      <div className="overflow-hidden bg-white shadow-sm lg:hidden" style={{ border: '1px solid var(--apg-border-default)' }}>
        <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))' }}>
          <span>✈ {fromCode} → {toCode} · {date}</span>
          <span className="font-normal text-white/70">{countLabel}</span>
        </div>
        {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
        {isDesktopViewport === false && (
          <DateStrip
            className="rounded-none border-x-0 border-t-0 shadow-none"
            destination={toCode}
            direction="depart"
            origin={fromCode}
            selectedDate={date}
            onSelect={onSelectDate}
          />
        )}
        {routeMatchesResults ? (
          <>
            <FilterBar flights={results} filter={filter} showStopFilter={!isDomesticRoute} onChange={onFilterChange} sortMode={sortMode} onSortChange={onSortChange} />
            {renderRows('p-3 text-center text-xs text-slate-500', 520)}
          </>
        ) : (
          renderSkeletonRows(true)
        )}
      </div>

      {/* DESKTOP — single column (mockup style) */}
      <div className="hidden lg:block lg:pt-5">
        <div className="mx-auto max-w-[860px]">
          <section className="overflow-hidden rounded-[14px] border border-[#d8dce0] bg-white shadow-sm">
            {navyHeader}
            {isDesktopViewport === true && routeMatchesResults && (
              <DateStrip className="rounded-none border-0 shadow-none" destination={toCode} direction="depart" origin={fromCode} selectedDate={date} onSelect={onSelectDate} />
            )}
            {routeMatchesResults && selectedFlight && (
              <div className="px-4 pt-4">
                <SelectedDesktopFlight label="Đã chọn" flight={selectedFlight} accent="var(--apg-text-secondary)" dailyMinPrice={dailyMinPrice} />
              </div>
            )}
            {routeMatchesResults && (
              <FilterBar flights={results} filter={filter} showStopFilter={!isDomesticRoute} onChange={onFilterChange} sortMode={sortMode} onSortChange={onSortChange} />
            )}
            {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
            {routeMatchesResults ? renderRows('p-6 text-center text-sm text-[var(--apg-text-secondary)]', 760, false) : renderSkeletonRows()}
          </section>
        </div>
      </div>
    </>
  );
}
