"use client";

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import AirlineLogo from '@/components/flight/AirlineLogo';
import { FilterBar, SelectedDesktopFlight, type FilterState } from '@/components/flight/FlightFilters';
import { FlightRowSkeleton, LoadMoreRowsButton, RouteMismatchNotice, type AirportLabelMap } from '@/components/flight/FlightRow';
import VirtualizedFlightRows from '@/components/flight/VirtualizedFlightRows';
import type { DateStripProps } from '@/components/search/DateStrip';
import type { FlightResult, RoundtripPairOption } from '@/lib/types';
import { fmtVND, hhmm } from '@/lib/utils';
import { isBookablePair, pairSourceLabel } from '@/lib/roundtrip';

export type RoundtripViewMode = 'pair' | 'legs';
export type RoundtripMobileTab = 'outbound' | 'inbound';

// YMD ("2026-07-09") → "09/07/2026" cho hiển thị (ngày/tháng/năm).
function fmtDMY(ymd: string): string {
  if (!ymd || ymd.length < 10) return ymd || '';
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

// Pill ngày nổi bật trên header cột (khắc phục "ngày quá mờ").
function HeaderDatePill({ ymd }: { ymd: string }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-[3px] text-[12px] font-extrabold leading-none text-white ring-1 ring-white/30">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      {fmtDMY(ymd)}
    </span>
  );
}

function RoundtripDateStripSkeleton() {
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
  loading: () => <RoundtripDateStripSkeleton />,
  ssr: false,
});

function RoundtripPairCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--apg-border-default)] bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] bg-white px-3 py-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200/70" />
            <div className="space-y-1.5">
              <div className="h-3 w-40 animate-pulse rounded bg-slate-200/70" />
              <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200/50" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-200/70" />
              <div className="ml-auto h-2.5 w-12 animate-pulse rounded bg-slate-200/50" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--apg-border-default)] pt-3">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200/70" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-slate-200/60" />
      </div>
    </div>
  );
}

function RoundtripPairSourceBar({
  sources,
  activeSource,
  onChange,
}: {
  sources: Array<{ source: string; count: number }>;
  activeSource: string;
  onChange: (value: string) => void;
}) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={`apg-chip h-8 px-3 text-xs ${activeSource === 'all' ? 'apg-chip-active shadow-sm' : ''}`}
        onClick={() => onChange('all')}
        type="button"
      >
        Tất cả cặp
      </button>
      {sources.map(({ source, count }) => (
        <button
          className={`apg-chip h-8 px-3 text-xs ${activeSource === source ? 'apg-chip-active shadow-sm' : ''}`}
          key={source}
          onClick={() => onChange(source)}
          type="button"
        >
          {pairSourceLabel(source)} · {count}
        </button>
      ))}
    </div>
  );
}

function RoundtripPairCard({
  pair,
  selected,
  disabled = false,
  onSelect,
}: {
  pair: RoundtripPairOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const outboundTotal = pair.outbound.fareBreakdown?.totalAmount ?? pair.outbound.price.amount;
  const inboundTotal = pair.inbound.fareBreakdown?.totalAmount ?? pair.inbound.price.amount;

  const legLine = (label: string, flight: FlightResult, accent: string) => (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] bg-white px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: accent }}>
          {label}
        </span>
        <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={22} />
      </div>
      <div className="min-w-0">
        <div className="apg-mono text-sm font-bold text-[#1a1a1a]">
          {flight.flightNumber} · {hhmm(flight.departure.time)} → {hhmm(flight.arrival.time)}
        </div>
        <div className="truncate text-xs text-slate-500">
          {flight.departure.airport} → {flight.arrival.airport} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}
        </div>
      </div>
      <div className="text-right">
        {(label === 'Chiều đi' ? outboundTotal : inboundTotal) > 0 ? (
          <>
            <div className="apg-tabular text-sm font-black text-[#1a1a1a]">{fmtVND(label === 'Chiều đi' ? outboundTotal : inboundTotal)}</div>
            <div className="text-[10px] text-slate-400">/người</div>
          </>
        ) : (
          <div className="text-[10px] font-semibold text-slate-400">Đã gồm trong giá tổng</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
      selected ? 'border-[var(--apg-aviation-navy-mid)] bg-[var(--apg-bg-surface-soft)]' : 'border-[var(--apg-border-default)]'
    }`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--apg-aviation-navy)] px-3 py-1 text-xs font-black text-white">{pairSourceLabel(pair.source || pair.systemName)}</span>
          <div>
            <div className="apg-display text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Cặp khứ hồi</div>
            <div className="text-xs text-slate-500">{pair.systemName || 'GDS roundtrip combo'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="apg-tabular text-xl font-black text-[#1a1a1a]">{fmtVND(pair.totalAmount)}</div>
          <div className="text-[11px] text-slate-400">≈ ${pair.totalUSD} · /người</div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {legLine('Chiều đi', pair.outbound, 'var(--apg-aviation-navy)')}
        {legLine('Chiều về', pair.inbound, 'var(--apg-route-inbound)')}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--apg-border-default)] px-4 py-3">
        <div className="text-xs text-slate-500">
          {pair.airlines.join(' · ')} · {pair.stops === 0 ? 'Bay thẳng' : `${pair.stops} điểm dừng toàn hành trình`}
        </div>
        <button
          className="apg-btn-primary h-10 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={onSelect}
          type="button"
        >
          {disabled ? 'Đang hoàn tất dữ liệu' : 'Chọn cặp này'}
        </button>
      </div>
    </div>
  );
}

type PairRowProps = {
  pairs: RoundtripPairOption[];
  resultsGen: number;
  selectedPairId: string;
  onSelect: (pair: RoundtripPairOption) => void;
};

function VirtualPairRow({
  ariaAttributes,
  index,
  pairs,
  resultsGen,
  selectedPairId,
  style,
  onSelect,
}: RowComponentProps<PairRowProps>) {
  const pair = pairs[index];
  if (!pair) return null;

  return (
    <div {...ariaAttributes} style={style}>
      <div className="pb-4">
        <div className="apg-row-in" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
          <RoundtripPairCard
            disabled={!isBookablePair(pair)}
            pair={pair}
            selected={selectedPairId === pair.id}
            onSelect={() => onSelect(pair)}
          />
        </div>
      </div>
    </div>
  );
}

function VirtualizedRoundtripPairCards({
  pairs,
  resultsGen,
  selectedPairId,
  onSelect,
}: {
  pairs: RoundtripPairOption[];
  resultsGen: number;
  selectedPairId: string;
  onSelect: (pair: RoundtripPairOption) => void;
}) {
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 244,
    key: `pairs-${pairs.length}-${selectedPairId}`,
  });

  if (pairs.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--apg-border-default)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
        Không có cặp khứ hồi phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  if (pairs.length < 10) {
    return (
      <>
        {pairs.map((pair, index) => (
          <div key={`${resultsGen}-${pair.id}`} className="apg-row-in" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
            <RoundtripPairCard
              disabled={!isBookablePair(pair)}
              pair={pair}
              selected={selectedPairId === pair.id}
              onSelect={() => onSelect(pair)}
            />
          </div>
        ))}
      </>
    );
  }

  const height = Math.min(760, Math.max(244, pairs.length * 244));

  return (
    <List
      className="bg-transparent"
      defaultHeight={height}
      overscanCount={3}
      rowComponent={VirtualPairRow}
      rowCount={pairs.length}
      rowHeight={rowHeight}
      rowProps={{ pairs, resultsGen, selectedPairId, onSelect }}
      style={{ height, width: '100%' }}
    />
  );
}

export default function RoundtripResultsSection({
  fromCode,
  toCode,
  date,
  returnDateLabel,
  pairOptions,
  roundtripViewMode,
  onRoundtripViewModeChange,
  routeMatchesResults,
  visiblePairOptions,
  sourceScopedPairCount,
  pairLoadedNotice,
  pairAnchorFlight,
  pairSources,
  pairSourceFilter,
  pairFilterOutboundFlights,
  pairFilterInboundFlights,
  onPairSourceFilterChange,
  streamStatusLabel,
  streamErrorCount,
  streamState,
  isReloading,
  isDomesticRoute,
  resultsGen,
  selectedPairId,
  onSelectPair,
  hasMorePairOptions,
  displayablePairCount,
  pairLoadMoreStep,
  onLoadMorePairs,
  isMobileViewport,
  isDesktopViewport,
  outboundResults,
  inboundResults,
  sortedOutbound,
  sortedInbound,
  visibleOutbound,
  visibleInbound,
  filterOutbound,
  filterInbound,
  onFilterOutboundChange,
  onFilterInboundChange,
  sortDepart,
  sortReturn,
  onSortDepartChange,
  onSortReturnChange,
  selectedOutbound,
  selectedInbound,
  onClearOutbound,
  onClearInbound,
  onSelectFlight,
  outboundDailyMinPrice,
  inboundDailyMinPrice,
  onLoadMoreOutbound,
  onLoadMoreInbound,
  flightLoadMoreStep,
  onSelectDepartDate,
  onSelectReturnDate,
  airportLabels,
}: {
  fromCode: string;
  toCode: string;
  date: string;
  returnDateLabel: string;
  pairOptions: RoundtripPairOption[];
  roundtripViewMode: RoundtripViewMode;
  onRoundtripViewModeChange: (value: RoundtripViewMode) => void;
  routeMatchesResults: boolean;
  visiblePairOptions: RoundtripPairOption[];
  sourceScopedPairCount: number;
  pairLoadedNotice: string;
  pairAnchorFlight: FlightResult | null;
  pairSources: Array<{ source: string; count: number }>;
  pairSourceFilter: string;
  pairFilterOutboundFlights: FlightResult[];
  pairFilterInboundFlights: FlightResult[];
  onPairSourceFilterChange: (value: string) => void;
  streamStatusLabel: string;
  streamErrorCount: number;
  streamState: { active: boolean; total: number; completed: number };
  isReloading: boolean;
  isDomesticRoute: boolean;
  resultsGen: number;
  selectedPairId: string;
  onSelectPair: (pair: RoundtripPairOption) => void;
  hasMorePairOptions: boolean;
  displayablePairCount: number;
  pairLoadMoreStep: number;
  onLoadMorePairs: () => void;
  mobileRoundtripTab: RoundtripMobileTab;
  onMobileRoundtripTabChange: (value: RoundtripMobileTab) => void;
  isMobileViewport: boolean | null;
  isDesktopViewport: boolean | null;
  outboundResults: FlightResult[];
  inboundResults: FlightResult[];
  sortedOutbound: FlightResult[];
  sortedInbound: FlightResult[];
  visibleOutbound: FlightResult[];
  visibleInbound: FlightResult[];
  filterOutbound: FilterState;
  filterInbound: FilterState;
  onFilterOutboundChange: (value: FilterState) => void;
  onFilterInboundChange: (value: FilterState) => void;
  sortDepart: 'price' | 'time';
  sortReturn: 'price' | 'time';
  onSortDepartChange: (value: 'price' | 'time') => void;
  onSortReturnChange: (value: 'price' | 'time') => void;
  selectedOutbound: FlightResult | null;
  selectedInbound: FlightResult | null;
  onClearOutbound: () => void;
  onClearInbound: () => void;
  onSelectFlight: (flight: FlightResult, direction: 'outbound' | 'inbound') => void | Promise<void>;
  outboundDailyMinPrice?: number | null;
  inboundDailyMinPrice?: number | null;
  onLoadMoreOutbound: () => void;
  onLoadMoreInbound: () => void;
  flightLoadMoreStep: number;
  onSelectDepartDate: (date: string) => void;
  onSelectReturnDate: (date: string) => void;
  onContinue: () => void;
  selectionTotal?: number;
  airportLabels: AirportLabelMap;
}) {
  // Mobile 2-cột: bộ lọc gộp mở/đóng chung cho cả 2 chiều.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const mobileFilterCount =
    filterOutbound.airlines.length +
    filterInbound.airlines.length +
    (filterOutbound.departureWindow && filterOutbound.departureWindow !== 'all' ? 1 : 0) +
    (filterInbound.departureWindow && filterInbound.departureWindow !== 'all' ? 1 : 0) +
    (filterOutbound.stops !== 'all' ? 1 : 0) +
    (filterInbound.stops !== 'all' ? 1 : 0);

  const renderFlightList = ({
    btnColor,
    dailyMinPrice,
    dense = false,
    emptyClassName,
    flights,
    maxHeightPx,
    remaining,
    selectDir,
    selectedFlight,
    visibleFlights,
    onClearSelected,
    onLoadMore,
  }: {
    btnColor: 'gold' | 'blue';
    dailyMinPrice?: number | null;
    dense?: boolean;
    emptyClassName: string;
    flights: FlightResult[];
    maxHeightPx: number;
    remaining: number;
    selectDir: 'outbound' | 'inbound';
    selectedFlight: FlightResult | null;
    visibleFlights: FlightResult[];
    onClearSelected: () => void;
    onLoadMore: () => void;
  }) => (
    <>
      <VirtualizedFlightRows
        airportLabels={airportLabels}
        btnColor={btnColor}
        dailyMinPrice={dailyMinPrice}
        dense={dense}
        emptyClassName={emptyClassName}
        flights={visibleFlights}
        maxHeightPx={maxHeightPx}
        resultsGen={resultsGen}
        selectedFlightId={selectedFlight?.id}
        showRouteColumn={false}
        onDeselect={() => onClearSelected()}
        onSelect={(flight) => onSelectFlight(flight, selectDir)}
      />
      <LoadMoreRowsButton remaining={remaining} step={flightLoadMoreStep} onClick={onLoadMore} />
    </>
  );

  return (
    <div>
      <div className="min-w-0">
      {pairOptions.length > 0 && (
        <div className="mb-4 mt-4 rounded-2xl border border-[var(--apg-border-default)] bg-white px-4 py-4 shadow-sm lg:mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="apg-eyebrow">Chế độ hiển thị khứ hồi</div>
              <div className="mt-1 text-sm text-slate-500">
                Bạn có thể chọn nhanh theo cặp khứ hồi dựng sẵn, hoặc quay về chế độ chọn từng chiều.
              </div>
            </div>
            <div className="inline-flex rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] p-1">
              {([
                ['pair', 'Cặp khứ hồi'],
                ['legs', 'Từng chiều'],
              ] as [RoundtripViewMode, string][]).map(([value, label]) => (
                <button
                  className={`rounded-[var(--apg-radius-sm)] px-3 py-2 text-xs font-semibold transition-all ${
                    roundtripViewMode === value
                      ? 'bg-[var(--apg-aviation-navy)] text-white shadow-sm'
                      : 'text-[var(--apg-text-secondary)] hover:bg-white'
                  }`}
                  key={value}
                  onClick={() => onRoundtripViewModeChange(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {roundtripViewMode === 'pair' && pairOptions.length > 0 && (
        <div className="space-y-4 lg:space-y-5">
          <div className="rounded-2xl border border-[var(--apg-border-default)] bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="apg-eyebrow">Cặp khứ hồi dựng sẵn</div>
                <div className="mt-1 apg-display text-[22px] font-semibold text-[var(--apg-aviation-navy)]">
                  {fromCode} → {toCode} → {fromCode}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {routeMatchesResults
                    ? `${visiblePairOptions.length}/${sourceScopedPairCount || pairOptions.length} cặp hiển thị${pairLoadedNotice} · ${fmtDMY(date)} - ${fmtDMY(returnDateLabel)}`
                    : `Bấm "Tìm vé" để cập nhật cặp khứ hồi cho chặng mới`}
                </div>
                {routeMatchesResults && pairAnchorFlight && (
                  <div className="mt-2 rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-2 text-xs text-[var(--apg-text-secondary)]">
                    <span className="font-semibold text-[var(--apg-aviation-navy)]">Chiều đi đang neo:</span>{' '}
                    <span className="apg-mono font-semibold text-[#1a1a1a]">
                      {pairAnchorFlight.flightNumber} · {hhmm(pairAnchorFlight.departure.time)} → {hhmm(pairAnchorFlight.arrival.time)}
                    </span>{' '}
                    <span className="text-slate-400">· {pairAnchorFlight.stops === 0 ? 'Bay thẳng' : `${pairAnchorFlight.stops} điểm dừng`}</span>
                  </div>
                )}
              </div>
              <RoundtripPairSourceBar
                sources={pairSources}
                activeSource={pairSourceFilter}
                onChange={onPairSourceFilterChange}
              />
            </div>
            {routeMatchesResults && streamStatusLabel && (
              <div className="mt-3 rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--apg-text-secondary)]">
                  <span className="font-semibold text-[var(--apg-aviation-navy)]">{streamStatusLabel}</span>
                  {streamErrorCount > 0 && <span>{streamErrorCount} nguồn lỗi</span>}
                </div>
                {streamState.active && streamState.total > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[var(--apg-aviation-navy)] transition-all duration-300"
                      style={{ width: `${Math.max(6, Math.min(100, Math.round((streamState.completed / streamState.total) * 100)))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {routeMatchesResults && (
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white shadow-sm">
                <div className="border-b border-[var(--apg-border-default)] px-3 py-2">
                  <div className="apg-eyebrow">Lọc chiều đi</div>
                </div>
                <FilterBar
                  flights={pairFilterOutboundFlights}
                  filter={filterOutbound}
                  showStopFilter={!isDomesticRoute}
                  onChange={onFilterOutboundChange}
                />
              </section>
              <section className="overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white shadow-sm">
                <div className="border-b border-[var(--apg-border-default)] px-3 py-2">
                  <div className="apg-eyebrow">Lọc chiều về</div>
                </div>
                <FilterBar
                  flights={pairFilterInboundFlights}
                  filter={filterInbound}
                  showStopFilter={!isDomesticRoute}
                  onChange={onFilterInboundChange}
                />
              </section>
            </div>
          )}

          {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
          {!routeMatchesResults && <RouteMismatchNotice />}
          <div className="space-y-4">
            {!routeMatchesResults ? (
              Array.from({ length: 3 }).map((_, index) => (<RoundtripPairCardSkeleton key={index} />))
            ) : (
              <VirtualizedRoundtripPairCards
                pairs={visiblePairOptions}
                resultsGen={resultsGen}
                selectedPairId={selectedPairId}
                onSelect={onSelectPair}
              />
            )}
            {routeMatchesResults && hasMorePairOptions && (
              <div className="flex justify-center">
                <button
                  className="apg-btn-secondary h-11 px-5 text-sm font-bold"
                  onClick={onLoadMorePairs}
                  type="button"
                >
                  Tải thêm {Math.min(pairLoadMoreStep, displayablePairCount - visiblePairOptions.length)} cặp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hiện chế độ "từng chiều" khi user chọn legs HOẶC khi không có cặp dựng sẵn
          (pairOptions rỗng). Nếu thiếu điều kiện pairOptions===0, user đang ở mode 'pair'
          (đã lưu) mà route không có cặp sẽ thấy MÀN HÌNH TRỐNG không có chuyến để chọn. */}
      {(roundtripViewMode === 'legs' || pairOptions.length === 0) && (
        <>
          <div className="md:hidden">
            {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
            {routeMatchesResults && (
              <>
                <div className="flex items-center justify-between gap-2 px-0.5 pb-2 pt-1">
                  <button
                    aria-expanded={mobileFilterOpen}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--apg-border-default)] bg-white px-3 text-[12px] font-semibold text-[var(--apg-aviation-navy)] transition hover:bg-[var(--apg-bg-surface-soft)]"
                    onClick={() => setMobileFilterOpen((value) => !value)}
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                    Lọc
                    {mobileFilterCount > 0 && (
                      <span className="rounded-full bg-[var(--apg-brand-gold)] px-1.5 text-[10px] font-bold text-white">{mobileFilterCount}</span>
                    )}
                    <svg className={mobileFilterOpen ? 'rotate-180 transition-transform' : 'transition-transform'} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <div className="inline-flex h-8 items-center rounded-full border border-[var(--apg-border-default)] bg-white p-0.5">
                    {([['price', 'Giá'], ['time', 'Giờ']] as ['price' | 'time', string][]).map(([value, label]) => {
                      const active = sortDepart === value;
                      return (
                        <button
                          className={`h-7 rounded-full px-3 text-[11px] font-bold leading-none transition ${active ? 'bg-[#1f8a5b] text-white shadow-[0_1px_2px_rgba(31,138,91,0.40)]' : 'text-[var(--apg-text-secondary)]'}`}
                          key={value}
                          onClick={() => { onSortDepartChange(value); onSortReturnChange(value); }}
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {mobileFilterOpen && (
                  <div className="mb-2 overflow-hidden rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)]">
                    <FilterBar flights={outboundResults} filter={filterOutbound} showStopFilter={!isDomesticRoute} onChange={onFilterOutboundChange} />
                    <FilterBar flights={inboundResults} filter={filterInbound} showStopFilter={!isDomesticRoute} onChange={onFilterInboundChange} />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-[var(--apg-radius-md)]" style={{ border: '1px solid var(--apg-border-default)' }}>
              <div style={{ borderRight: '1px solid var(--apg-border-default)' }}>
                <div className="px-2 py-2 text-center text-white" style={{ background: '#ee8b1e' }}>
                  <div className="apg-display text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80">Chiều đi</div>
                  <div className="text-[12px] font-bold leading-tight">{fromCode} → {toCode}</div>
                  <HeaderDatePill ymd={date} />
                  <div className="apg-tabular mt-0.5 text-[8.5px] font-normal text-white/75">{routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length} chuyến` : '—/—'}</div>
                </div>
                {isMobileViewport === true && routeMatchesResults && (
                  <DateStrip
                    compact
                    className="rounded-none border-x-0 border-t-0 shadow-none"
                    destination={toCode}
                    direction="depart"
                    origin={fromCode}
                    selectedDate={date}
                    onSelect={onSelectDepartDate}
                  />
                )}
                <div className="border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-1.5 py-1 text-center text-[8.5px] leading-tight text-[var(--apg-text-muted)]">Giá gốc/khách (nghìn đ) · thuế phí ở bước chọn</div>
                {routeMatchesResults ? (
                  renderFlightList({
                    btnColor: 'gold',
                    dailyMinPrice: outboundDailyMinPrice,
                    dense: true,
                    emptyClassName: 'p-3 text-center text-[10px] text-slate-400',
                    flights: sortedOutbound,
                    maxHeightPx: 460,
                    remaining: sortedOutbound.length - visibleOutbound.length,
                    selectDir: 'outbound',
                    selectedFlight: selectedOutbound,
                    visibleFlights: visibleOutbound,
                    onClearSelected: onClearOutbound,
                    onLoadMore: onLoadMoreOutbound,
                  })
                ) : (
                  <>
                    <RouteMismatchNotice dense />
                    <div className="max-h-[55vh] overflow-auto">
                      {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} dense />))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <div className="px-2 py-2 text-center text-white" style={{ background: 'var(--apg-aviation-navy)' }}>
                  <div className="apg-display text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80">Chiều về</div>
                  <div className="text-[12px] font-bold leading-tight">{toCode} → {fromCode}</div>
                  <HeaderDatePill ymd={returnDateLabel} />
                  <div className="apg-tabular mt-0.5 text-[8.5px] font-normal text-white/75">{routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length} chuyến` : '—/—'}</div>
                </div>
                {isMobileViewport === true && routeMatchesResults && (
                  <DateStrip
                    compact
                    className="rounded-none border-x-0 border-t-0 shadow-none"
                    destination={fromCode}
                    direction="return"
                    origin={toCode}
                    selectedDate={returnDateLabel}
                    onSelect={onSelectReturnDate}
                  />
                )}
                <div className="border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-1.5 py-1 text-center text-[8.5px] leading-tight text-[var(--apg-text-muted)]">Giá gốc/khách (nghìn đ) · thuế phí ở bước chọn</div>
                {routeMatchesResults ? (
                  renderFlightList({
                    btnColor: 'blue',
                    dailyMinPrice: inboundDailyMinPrice,
                    dense: true,
                    emptyClassName: 'p-3 text-center text-[10px] text-slate-400',
                    flights: sortedInbound,
                    maxHeightPx: 460,
                    remaining: sortedInbound.length - visibleInbound.length,
                    selectDir: 'inbound',
                    selectedFlight: selectedInbound,
                    visibleFlights: visibleInbound,
                    onClearSelected: onClearInbound,
                    onLoadMore: onLoadMoreInbound,
                  })
                ) : (
                  <>
                    <RouteMismatchNotice dense />
                    <div className="max-h-[55vh] overflow-auto">
                      {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} dense />))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-0 bg-white md:grid lg:hidden" style={{ border: '1px solid var(--apg-border-default)' }}>
            <div style={{ borderRight: '1px solid var(--apg-border-default)' }}>
              <div className="px-1.5 py-2 text-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))' }}>
                <div className="truncate">Đi: {fromCode}→{toCode}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] font-normal text-white/80">
                  <span>{fmtDMY(date)}</span>
                  <span className="text-white/60">• {routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length}` : '—/—'}</span>
                </div>
              </div>
              {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
              {isMobileViewport === false && isDesktopViewport === false && (
                <DateStrip
                  className="rounded-none border-x-0 border-t-0 shadow-none"
                  destination={toCode}
                  direction="depart"
                  origin={fromCode}
                  selectedDate={date}
                  onSelect={onSelectDepartDate}
                />
              )}
              {routeMatchesResults ? (
                <>
                  <FilterBar flights={outboundResults} filter={filterOutbound} showStopFilter={!isDomesticRoute} onChange={onFilterOutboundChange} sortMode={sortDepart} onSortChange={onSortDepartChange} />
                  {renderFlightList({
                    btnColor: 'gold',
                    dailyMinPrice: outboundDailyMinPrice,
                    dense: true,
                    emptyClassName: 'p-3 text-center text-[10px] text-slate-400',
                    flights: sortedOutbound,
                    maxHeightPx: 460,
                    remaining: sortedOutbound.length - visibleOutbound.length,
                    selectDir: 'outbound',
                    selectedFlight: selectedOutbound,
                    visibleFlights: visibleOutbound,
                    onClearSelected: onClearOutbound,
                    onLoadMore: onLoadMoreOutbound,
                  })}
                </>
              ) : (
                <>
                  <RouteMismatchNotice dense />
                  <div className="max-h-[55vh] overflow-auto">
                    {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} dense />))}
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="px-1.5 py-2 text-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))' }}>
                <div className="truncate">Về: {toCode}→{fromCode}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] font-normal text-white/80">
                  <span>{fmtDMY(returnDateLabel)}</span>
                  <span className="text-white/60">• {routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length}` : '—/—'}</span>
                </div>
              </div>
              {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
              {isMobileViewport === false && isDesktopViewport === false && (
                <DateStrip
                  className="rounded-none border-x-0 border-t-0 shadow-none"
                  destination={fromCode}
                  direction="return"
                  origin={toCode}
                  selectedDate={returnDateLabel}
                  onSelect={onSelectReturnDate}
                />
              )}
              {routeMatchesResults ? (
                <>
                  <FilterBar flights={inboundResults} filter={filterInbound} showStopFilter={!isDomesticRoute} onChange={onFilterInboundChange} sortMode={sortReturn} onSortChange={onSortReturnChange} />
                  {renderFlightList({
                    btnColor: 'blue',
                    dailyMinPrice: inboundDailyMinPrice,
                    dense: true,
                    emptyClassName: 'p-3 text-center text-[10px] text-slate-400',
                    flights: sortedInbound,
                    maxHeightPx: 460,
                    remaining: sortedInbound.length - visibleInbound.length,
                    selectDir: 'inbound',
                    selectedFlight: selectedInbound,
                    visibleFlights: visibleInbound,
                    onClearSelected: onClearInbound,
                    onLoadMore: onLoadMoreInbound,
                  })}
                </>
              ) : (
                <>
                  <RouteMismatchNotice dense />
                  <div className="max-h-[55vh] overflow-auto">
                    {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} dense />))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:pt-6">
            <section className="overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white shadow-sm">
              <div className="border-b border-[var(--apg-border-default)] bg-white">
                <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid))' }}>
                  <div className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">Chiều đi</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="apg-display text-[24px] font-semibold text-white">{fromCode} → {toCode}</div>
                    <div className="apg-tabular text-sm font-semibold text-white/90">{routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length}` : '—/—'}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/80">{fmtDMY(date)}</div>
                </div>
                {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
                {isDesktopViewport === true && (
                  <DateStrip
                    className="rounded-none border-x-0 border-t-0 shadow-none"
                    destination={toCode}
                    direction="depart"
                    origin={fromCode}
                    selectedDate={date}
                    onSelect={onSelectDepartDate}
                  />
                )}
                {routeMatchesResults && selectedOutbound && (
                  <div className="px-4 py-4">
                    <SelectedDesktopFlight label="Đã chọn" flight={selectedOutbound} accent="var(--apg-text-secondary)" dailyMinPrice={outboundDailyMinPrice} />
                  </div>
                )}
                {routeMatchesResults && (
                  <FilterBar flights={outboundResults} filter={filterOutbound} showStopFilter={!isDomesticRoute} onChange={onFilterOutboundChange} sortMode={sortDepart} onSortChange={onSortDepartChange} />
                )}
              </div>
              {routeMatchesResults ? (
                <div>
                  {renderFlightList({
                    btnColor: 'gold',
                    dailyMinPrice: outboundDailyMinPrice,
                    emptyClassName: 'p-6 text-center text-sm text-slate-500',
                    flights: sortedOutbound,
                    maxHeightPx: 720,
                    remaining: sortedOutbound.length - visibleOutbound.length,
                    selectDir: 'outbound',
                    selectedFlight: selectedOutbound,
                    visibleFlights: visibleOutbound,
                    onClearSelected: onClearOutbound,
                    onLoadMore: onLoadMoreOutbound,
                  })}
                </div>
              ) : (
                <>
                  <RouteMismatchNotice />
                  <div>
                    {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} />))}
                  </div>
                </>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white shadow-sm">
              <div className="border-b border-[var(--apg-border-default)] bg-white">
                <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))' }}>
                  <div className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">Chiều về</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="apg-display text-[24px] font-semibold text-white">{toCode} → {fromCode}</div>
                    <div className="apg-tabular text-sm font-semibold text-white/90">{routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length}` : '—/—'}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/80">{fmtDMY(returnDateLabel)}</div>
                </div>
                {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
                {isDesktopViewport === true && (
                  <DateStrip
                    className="rounded-none border-x-0 border-t-0 shadow-none"
                    destination={fromCode}
                    direction="return"
                    origin={toCode}
                    selectedDate={returnDateLabel}
                    onSelect={onSelectReturnDate}
                  />
                )}
                {routeMatchesResults && selectedInbound && (
                  <div className="px-4 py-4">
                    <SelectedDesktopFlight label="Đã chọn" flight={selectedInbound} accent="var(--apg-route-inbound)" dailyMinPrice={inboundDailyMinPrice} />
                  </div>
                )}
                {routeMatchesResults && (
                  <FilterBar flights={inboundResults} filter={filterInbound} showStopFilter={!isDomesticRoute} onChange={onFilterInboundChange} sortMode={sortReturn} onSortChange={onSortReturnChange} />
                )}
              </div>
              {routeMatchesResults ? (
                <div>
                  {renderFlightList({
                    btnColor: 'blue',
                    dailyMinPrice: inboundDailyMinPrice,
                    emptyClassName: 'p-6 text-center text-sm text-slate-500',
                    flights: sortedInbound,
                    maxHeightPx: 720,
                    remaining: sortedInbound.length - visibleInbound.length,
                    selectDir: 'inbound',
                    selectedFlight: selectedInbound,
                    visibleFlights: visibleInbound,
                    onClearSelected: onClearInbound,
                    onLoadMore: onLoadMoreInbound,
                  })}
                </div>
              ) : (
                <>
                  <RouteMismatchNotice />
                  <div>
                    {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} />))}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
