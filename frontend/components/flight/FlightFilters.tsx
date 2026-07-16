"use client";

import { useMemo, type ReactNode } from 'react';
import AirlineLogo from '@/components/flight/AirlineLogo';
import FlightBadgePills from '@/components/flight/FlightBadgePills';
import { buildFlightBadges } from '@/lib/flight-badges';
import type { DepartureWindowFilter, FilterState, StopFilter } from '@/lib/flightFilters';
import type { FlightResult } from '@/lib/types';
import { airlineChipLabel } from '@/lib/airlines';
import { fmtVND, hhmm } from '@/lib/utils';

export type { DepartureWindowFilter, FilterState, StopFilter } from '@/lib/flightFilters';

export function FilterBar({
  flights,
  filter,
  onChange,
  sortMode,
  onSortChange,
  showStopFilter = true,
}: {
  flights: FlightResult[];
  filter: FilterState;
  onChange: (f: FilterState) => void;
  sortMode?: 'price' | 'time';
  onSortChange?: (m: 'price' | 'time') => void;
  showStopFilter?: boolean;
}) {
  const airlines = useMemo(() => {
    const seen = new Map<string, string>();
    flights.forEach((flight) => {
      if (!seen.has(flight.airlineCode)) seen.set(flight.airlineCode, flight.airline);
    });
    return [...seen.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [flights]);

  if (!flights.length) return null;

  const activeSortMode = sortMode ?? 'price';
  const showSort = sortMode !== undefined && onSortChange !== undefined;
  const departureWindow = filter.departureWindow ?? 'all';
  const chipRowClass = "flex min-w-0 flex-nowrap gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden";

  const chip = (key: string, active: boolean, onClick: () => void, label: ReactNode) => (
    <button
      key={key}
      className={`apg-chip h-7 shrink-0 gap-1 px-2.5 text-[10px] ${active ? 'apg-chip-active' : ''}`}
      style={active ? { background: '#1f3a52', borderColor: '#1f3a52', color: '#fff' } : undefined}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );

  const filterGroup = (label: string, children: ReactNode) => (
    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-start gap-2 lg:grid-cols-[86px_minmax(0,1fr)]">
      <div className="whitespace-nowrap pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--apg-text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );

  const sortControl = showSort ? (
    <div className="order-last flex items-center justify-between gap-2 border-t border-[var(--apg-border-default)] pt-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:min-w-[178px] lg:justify-end lg:border-t-0 lg:pt-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--apg-text-muted)]">
        Sắp xếp theo
      </span>
      <button
        aria-checked={activeSortMode === 'time'}
        aria-label={`Đang sắp xếp theo ${activeSortMode === 'price' ? 'giá' : 'giờ'}, bấm để chuyển sang ${activeSortMode === 'price' ? 'giờ' : 'giá'}`}
        className="relative inline-flex h-7 w-[88px] shrink-0 items-center rounded-full border border-[var(--apg-border-default)] bg-white p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(47,143,210,0.6)]"
        onClick={() => onSortChange?.(activeSortMode === 'price' ? 'time' : 'price')}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0.5 left-0.5 w-[42px] rounded-full bg-[#1f8a5b] shadow-[0_1px_2px_rgba(31,138,91,0.40)] transition-transform duration-200 ease-out ${
            activeSortMode === 'time' ? 'translate-x-[42px]' : 'translate-x-0'
          }`}
        />
        <span className={`relative z-10 w-[42px] text-center text-[11px] font-bold leading-none transition ${activeSortMode === 'price' ? 'text-white' : 'text-[var(--apg-text-secondary)]'}`}>
          Giá
        </span>
        <span className={`relative z-10 w-[42px] text-center text-[11px] font-bold leading-none transition ${activeSortMode === 'time' ? 'text-white' : 'text-[var(--apg-text-secondary)]'}`}>
          Giờ
        </span>
      </button>
    </div>
  ) : null;

  return (
    <div className="border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-3">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-4">
        {filterGroup('Hãng bay', (
          <div className={chipRowClass}>
            {chip('airline-all', filter.airlines.length === 0, () => onChange({ ...filter, airlines: [] }), 'Tất cả HB')}
            {airlines.map(({ code, name }) => {
              const active = filter.airlines.includes(code);
              return chip(`airline-${code}`, active, () => {
                const next = active ? filter.airlines.filter((item) => item !== code) : [...filter.airlines, code];
                onChange({ ...filter, airlines: next });
              }, <><AirlineLogo code={code} airline={name} size={14} />{airlineChipLabel(code, name)}</>);
            })}
          </div>
        ))}

        {sortControl}

        {showStopFilter && (
          <div className="lg:col-start-1">
            {filterGroup('Điểm dừng', (
              <div className={chipRowClass}>
                {([['all', 'Tất cả'], ['0', 'Thẳng'], ['1', '1 dừng'], ['2+', '2+ dừng']] as [StopFilter, string][]).map(([value, label]) =>
                  chip(`stop-${value}`, filter.stops === value, () => onChange({ ...filter, stops: value }), label)
                )}
              </div>
            ))}
          </div>
        )}

        <div className="lg:col-start-1">
          {filterGroup('Giờ bay', (
            <div className={chipRowClass}>
              {([
                ['all', 'Cả ngày'],
                ['early', '0-6h'],
                ['morning', 'Sáng'],
                ['afternoon', 'Chiều'],
                ['evening', 'Tối'],
              ] as [DepartureWindowFilter, string][]).map(([value, label]) =>
                chip(`departure-${value}`, departureWindow === value, () => onChange({ ...filter, departureWindow: value }), label)
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SelectedDesktopFlight({
  label,
  flight,
  accent,
  dailyMinPrice,
}: {
  label: string;
  flight: FlightResult;
  accent: string;
  dailyMinPrice?: number | null;
}) {
  const total = flight.fareBreakdown?.totalAmount ?? flight.price.amount;
  const badges = buildFlightBadges(flight, dailyMinPrice);

  return (
    <div className="rounded-[var(--apg-radius-md)] border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="apg-display text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>{label}</div>
        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={24} />
        <div className="min-w-0 flex-1">
          <div className="apg-mono text-sm font-bold text-[#1a1a1a]">{flight.flightNumber} · {hhmm(flight.departure.time)} → {hhmm(flight.arrival.time)}</div>
          <div className="truncate text-xs text-slate-500">{flight.airline} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}</div>
          <FlightBadgePills badges={badges} className="mt-2" />
        </div>
        <div className="text-right">
          <div className="apg-tabular text-sm font-black text-[#1a1a1a]">{fmtVND(total)}</div>
          <div className="text-[10px] text-slate-400">/người</div>
        </div>
      </div>
    </div>
  );
}
