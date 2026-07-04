"use client";

import dynamic from 'next/dynamic';
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
  mobileRoundtripTab,
  onMobileRoundtripTabChange,
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
  const mobileRoundtripLeg = mobileRoundtripTab === 'outbound'
    ? {
        label: 'Chiều đi',
        shortLabel: 'Đi',
        route: `${fromCode} → ${toCode}`,
        dateLabel: date,
        countLabel: routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length}` : '—/—',
        flights: outboundResults,
        sortedFlights: sortedOutbound,
        visibleFlights: visibleOutbound,
        loadMore: onLoadMoreOutbound,
        filter: filterOutbound,
        setFilter: onFilterOutboundChange,
        sortMode: sortDepart,
        setSortMode: onSortDepartChange,
        selectedFlight: selectedOutbound,
        clearSelected: onClearOutbound,
        selectDir: 'outbound' as const,
        btnColor: 'gold' as const,
        dailyMinPrice: outboundDailyMinPrice,
        gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))',
        dateStrip: {
          destination: toCode,
          direction: 'depart' as const,
          origin: fromCode,
          selectedDate: date,
          onSelect: onSelectDepartDate,
        },
      }
    : {
        label: 'Chiều về',
        shortLabel: 'Về',
        route: `${toCode} → ${fromCode}`,
        dateLabel: returnDateLabel,
        countLabel: routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length}` : '—/—',
        flights: inboundResults,
        sortedFlights: sortedInbound,
        visibleFlights: visibleInbound,
        loadMore: onLoadMoreInbound,
        filter: filterInbound,
        setFilter: onFilterInboundChange,
        sortMode: sortReturn,
        setSortMode: onSortReturnChange,
        selectedFlight: selectedInbound,
        clearSelected: onClearInbound,
        selectDir: 'inbound' as const,
        btnColor: 'blue' as const,
        dailyMinPrice: inboundDailyMinPrice,
        gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))',
        dateStrip: {
          destination: fromCode,
          direction: 'return' as const,
          origin: toCode,
          selectedDate: returnDateLabel,
          onSelect: onSelectReturnDate,
        },
      };

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
                Bạn có thể chọn nhanh theo cặp khứ hồi dựng sẵn như Nam Thanh, hoặc quay về chế độ chọn từng chiều.
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
                    ? `${visiblePairOptions.length}/${sourceScopedPairCount || pairOptions.length} cặp hiển thị${pairLoadedNotice} · ${date} - ${returnDateLabel}`
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
          <div className="overflow-hidden bg-white shadow-sm md:hidden" style={{ border: '1px solid var(--apg-border-default)' }}>
            <div className="border-b border-[var(--apg-border-default)] bg-white p-2">
              <div className="grid grid-cols-2 gap-1 rounded-[var(--apg-radius-md)] bg-[var(--apg-bg-surface-soft)] p-1">
                {([
                  {
                    value: 'outbound' as const,
                    label: 'Chiều đi',
                    route: `${fromCode} → ${toCode}`,
                    count: routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length}` : '—/—',
                    selected: !!selectedOutbound,
                    gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))',
                  },
                  {
                    value: 'inbound' as const,
                    label: 'Chiều về',
                    route: `${toCode} → ${fromCode}`,
                    count: routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length}` : '—/—',
                    selected: !!selectedInbound,
                    gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))',
                  },
                ] satisfies Array<{
                  count: string;
                  gradient: string;
                  label: string;
                  route: string;
                  selected: boolean;
                  value: RoundtripMobileTab;
                }>).map((tab) => {
                  const active = mobileRoundtripTab === tab.value;
                  return (
                    <button
                      aria-selected={active}
                      className={`min-w-0 rounded-[var(--apg-radius-sm)] px-2.5 py-2 text-left transition-all ${
                        active ? 'text-white shadow-sm' : 'text-[var(--apg-text-secondary)] hover:bg-white'
                      }`}
                      key={tab.value}
                      onClick={() => onMobileRoundtripTabChange(tab.value)}
                      role="tab"
                      style={active ? { background: tab.gradient } : undefined}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="apg-display truncate text-[11px] font-semibold uppercase tracking-[0.16em]">
                          {tab.label}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${tab.selected ? 'bg-emerald-400' : active ? 'bg-white/55' : 'bg-slate-300'}`}
                        />
                      </div>
                      <div className={`mt-1 truncate text-[11px] font-semibold ${active ? 'text-white/90' : 'text-[#1a1a1a]'}`}>
                        {tab.route}
                      </div>
                      <div className={`mt-0.5 apg-tabular text-[10px] ${active ? 'text-white/70' : 'text-slate-400'}`}>
                        {tab.count}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-3 py-2 text-xs font-bold text-white" style={{ background: mobileRoundtripLeg.gradient }}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {mobileRoundtripLeg.shortLabel}: {mobileRoundtripLeg.route}
                </span>
                <span className="apg-tabular shrink-0 text-white/70">{mobileRoundtripLeg.countLabel}</span>
              </div>
              <div className="mt-0.5 text-[10px] font-normal text-white/78">{mobileRoundtripLeg.dateLabel}</div>
            </div>
            {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
            {isMobileViewport === true && (
              <DateStrip
                className="rounded-none border-x-0 border-t-0 shadow-none"
                destination={mobileRoundtripLeg.dateStrip.destination}
                direction={mobileRoundtripLeg.dateStrip.direction}
                origin={mobileRoundtripLeg.dateStrip.origin}
                selectedDate={mobileRoundtripLeg.dateStrip.selectedDate}
                onSelect={mobileRoundtripLeg.dateStrip.onSelect}
              />
            )}
            {routeMatchesResults ? (
              <>
                <FilterBar
                  flights={mobileRoundtripLeg.flights}
                  filter={mobileRoundtripLeg.filter}
                  showStopFilter={!isDomesticRoute}
                  onChange={mobileRoundtripLeg.setFilter}
                  sortMode={mobileRoundtripLeg.sortMode}
                  onSortChange={mobileRoundtripLeg.setSortMode}
                />
                {renderFlightList({
                  btnColor: mobileRoundtripLeg.btnColor,
                  dailyMinPrice: mobileRoundtripLeg.dailyMinPrice,
                  emptyClassName: 'p-3 text-center text-xs text-slate-500',
                  flights: mobileRoundtripLeg.sortedFlights,
                  maxHeightPx: 520,
                  remaining: mobileRoundtripLeg.sortedFlights.length - mobileRoundtripLeg.visibleFlights.length,
                  selectDir: mobileRoundtripLeg.selectDir,
                  selectedFlight: mobileRoundtripLeg.selectedFlight,
                  visibleFlights: mobileRoundtripLeg.visibleFlights,
                  onClearSelected: mobileRoundtripLeg.clearSelected,
                  onLoadMore: mobileRoundtripLeg.loadMore,
                })}
              </>
            ) : (
              <>
                <RouteMismatchNotice />
                <div className="max-h-[60vh] overflow-auto">
                  {Array.from({ length: 5 }).map((_, index) => (<FlightRowSkeleton key={index} />))}
                </div>
              </>
            )}
          </div>

          <div className="hidden grid-cols-2 gap-0 bg-white md:grid lg:hidden" style={{ border: '1px solid var(--apg-border-default)' }}>
            <div style={{ borderRight: '1px solid var(--apg-border-default)' }}>
              <div className="px-1.5 py-2 text-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))' }}>
                <div className="truncate">Đi: {fromCode}→{toCode}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] font-normal text-white/80">
                  <span>{date}</span>
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
                  <span>{returnDateLabel}</span>
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
                  <div className="mt-1 text-xs text-white/80">{date}</div>
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
                  <div className="mt-1 text-xs text-white/80">{returnDateLabel}</div>
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
