"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpDown, CalendarDays, ChevronDown, Minus, Plane, Plus, Users } from 'lucide-react';
import AirportInput from '@/components/AirportInput';
import type { AirportOption, AirportSelection, Cabin } from '@/lib/types';
import { filterAirports, matchAirport } from '@/lib/useAirports';

function mobileAirportDisplay(value: AirportSelection | null, airports: AirportOption[]) {
  if (!value?.code) return '';
  const airport = airports.find((item) => item.code === value.code);
  if (airport?.city) return `${airport.city}, VN`;
  return value.label?.split('(')[0]?.trim() || value.code;
}

function MobileAirportPicker({
  airports,
  icon,
  label,
  onSelect,
  placeholder,
  value,
}: {
  airports: AirportOption[];
  icon?: ReactNode;
  label: string;
  onSelect: (value: AirportSelection | null) => void;
  placeholder: string;
  value: AirportSelection | null;
}) {
  const [draft, setDraft] = useState(mobileAirportDisplay(value, airports));
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) setDraft(mobileAirportDisplay(value, airports));
  }, [airports, focused, value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      setOpen(false);
      setFocused(false);
      setDraft(mobileAirportDisplay(value, airports));
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [airports, value]);

  const list = useMemo(() => filterAirports(airports, draft, 7), [airports, draft]);

  const commit = (selection: AirportSelection | null) => {
    onSelect(selection);
    setDraft(mobileAirportDisplay(selection, airports));
    setOpen(false);
    setFocused(false);
  };

  const selectAll = () => {
    window.requestAnimationFrame(() => inputRef.current?.select());
  };

  const handleFocus = () => {
    setFocused(true);
    setOpen(true);
    setDraft(value?.label || value?.code || '');
    selectAll();
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const trimmed = draft.trim();
      if (!trimmed) {
        commit(null);
        return;
      }

      const matched = matchAirport(airports, trimmed);
      if (matched) {
        commit({ code: matched.code, label: matched.label });
        return;
      }

      setDraft(mobileAirportDisplay(value, airports));
      setOpen(false);
      setFocused(false);
    }, 120);
  };

  return (
    <div ref={ref} className="relative grid min-h-[72px] grid-cols-[28px_1fr] gap-3 border-b border-[var(--apg-border-default)] px-3 py-3 last:border-b-0">
      <div className="flex pt-5 text-[var(--apg-text-muted)]">
        {icon}
      </div>
      <div className="min-w-0">
        <label className="block text-[12px] font-semibold text-[var(--apg-text-secondary)]">{label}</label>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="apg-mono shrink-0 rounded-[var(--apg-radius-sm)] bg-[var(--apg-text-muted)] px-2 py-1 text-[11px] font-bold text-white">
            {value?.code || '---'}
          </span>
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-[17px] font-extrabold text-[var(--apg-aviation-navy)] outline-none placeholder:text-slate-400"
            onBlur={handleBlur}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onClick={selectAll}
            onFocus={handleFocus}
            placeholder={placeholder}
            value={draft}
          />
        </div>
        {open && (
          <div className="apg-dropdown absolute left-3 right-3 top-[calc(100%-4px)] z-50 max-h-[280px] overflow-auto">
            {list.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--apg-text-secondary)]">Không tìm thấy sân bay phù hợp.</div>
            ) : list.map((airport) => (
              <button
                className="flex w-full items-center gap-2 border-b border-[var(--apg-border-default)] px-3 py-2.5 text-left last:border-b-0"
                key={airport.code}
                onPointerDown={(event) => {
                  event.preventDefault();
                  commit({ code: airport.code, label: airport.label });
                }}
                type="button"
              >
                <span className="apg-mono rounded-[var(--apg-radius-sm)] bg-[var(--apg-text-muted)] px-2 py-1 text-[10px] font-bold text-white">{airport.code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--apg-text-primary)]">{airport.city}, {airport.country}</span>
                  <span className="block truncate text-[11px] text-[var(--apg-text-muted)]">{airport.name}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MobilePassengerCounter({
  icon,
  label,
  onDecrement,
  onIncrement,
  value,
  decrementDisabled,
  incrementDisabled,
}: {
  icon?: ReactNode;
  label: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  value: number;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
}) {
  const controlClass = "flex h-9 w-9 items-center justify-center rounded-full text-[var(--apg-text-secondary)] transition disabled:text-slate-300";

  return (
    <div className="grid min-h-[54px] grid-cols-[28px_1fr_auto] items-center gap-3 px-3 py-2">
      <div className="text-[var(--apg-text-muted)]">{icon}</div>
      <div className="min-w-0 text-[15px] font-semibold text-slate-700">{label}</div>
      <div className="grid grid-cols-[36px_36px_36px] items-center justify-items-center">
        <button aria-label="Giảm" className={controlClass} disabled={decrementDisabled} onClick={onDecrement} type="button">
          <Minus size={16} strokeWidth={2.3} />
        </button>
        <span className={`apg-tabular text-center text-lg font-black ${value > 0 ? 'text-[var(--apg-aviation-navy)]' : 'text-slate-300'}`}>{value}</span>
        <button aria-label="Tăng" className={controlClass} disabled={incrementDisabled} onClick={onIncrement} type="button">
          <Plus size={16} strokeWidth={2.3} />
        </button>
      </div>
    </div>
  );
}

export default function HomeSearchPanel({
  adults,
  airports,
  cabin,
  children,
  date,
  defaultReturnDate,
  error,
  fromSel,
  infants,
  isDesktopViewport,
  isReloading,
  loading,
  loadingHintText,
  minReturnDate,
  onCabinChange,
  onDateChange,
  onFromSelect,
  onPassengerCountsChange,
  onQuickRouteSelect,
  onReturnDateChange,
  onSearch,
  onSwapRoute,
  onToSelect,
  onTripTypeChange,
  quickRoutes,
  returnDate,
  todayYmd,
  toSel,
  tripType,
}: {
  adults: number;
  airports: AirportOption[];
  cabin: Cabin;
  children: number;
  date: string;
  defaultReturnDate: string;
  error: string;
  fromSel: AirportSelection | null;
  infants: number;
  isDesktopViewport: boolean | null;
  isReloading: boolean;
  loading: boolean;
  loadingHintText: string;
  minReturnDate: string;
  onCabinChange: (value: Cabin) => void;
  onDateChange: (value: string) => void;
  onFromSelect: (value: AirportSelection | null) => void;
  onPassengerCountsChange: (value: { adults: number; children: number; infants: number }) => void;
  onQuickRouteSelect: (from: AirportSelection, to: AirportSelection) => void;
  onReturnDateChange: (value: string) => void;
  onSearch: () => void;
  onSwapRoute: () => void;
  onToSelect: (value: AirportSelection | null) => void;
  onTripTypeChange: (value: 'oneway' | 'roundtrip') => void;
  quickRoutes: Array<{ from: AirportSelection; to: AirportSelection }>;
  returnDate: string;
  todayYmd: string;
  toSel: AirportSelection | null;
  tripType: 'oneway' | 'roundtrip';
}) {
  const busy = loading || isReloading;

  return (
    <div className="border border-t-0 border-[var(--apg-border-default)] bg-white px-3 py-3 shadow-sm lg:rounded-b-[var(--apg-radius-lg)] lg:px-5 lg:py-4">
      {isDesktopViewport !== true && (
        <div className="lg:hidden">
          <div className="grid grid-cols-2 rounded-[var(--apg-radius-md)] border border-[var(--apg-aviation-navy)] bg-white p-0.5">
            {(['oneway', 'roundtrip'] as const).map((type) => (
              <button
                aria-pressed={tripType === type}
                className={`h-9 rounded-[var(--apg-radius-sm)] text-sm font-bold transition ${
                  tripType === type
                    ? 'bg-[var(--apg-aviation-navy)] text-white shadow-sm'
                    : 'text-[var(--apg-text-secondary)]'
                }`}
                key={type}
                onClick={() => onTripTypeChange(type)}
                type="button"
              >
                {type === 'oneway' ? 'Một chiều' : 'Khứ hồi'}
              </button>
            ))}
          </div>

          <div className="relative mt-3 overflow-visible border-y border-[var(--apg-border-default)] bg-white">
            <MobileAirportPicker
              airports={airports}
              icon={<Plane size={22} strokeWidth={2.4} />}
              label="Khởi hành"
              onSelect={onFromSelect}
              placeholder="Chọn điểm đi"
              value={fromSel}
            />
            <button
              aria-label="Đổi chiều hành trình"
              className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--apg-border-default)] bg-white text-[var(--apg-aviation-navy)] shadow-[0_10px_24px_rgba(15,47,75,0.12)] transition active:scale-95"
              onClick={onSwapRoute}
              type="button"
            >
              <ArrowUpDown size={20} strokeWidth={2.4} />
            </button>
            <MobileAirportPicker
              airports={airports}
              label="Điểm đến"
              onSelect={onToSelect}
              placeholder="Chọn điểm đến"
              value={toSel}
            />
          </div>

          <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--apg-border-default)] px-3 py-3">
            <CalendarDays className="text-[var(--apg-text-muted)]" size={21} strokeWidth={2.3} />
            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-[var(--apg-text-secondary)]">
                {tripType === 'roundtrip' ? 'Ngày khởi hành / ngày về' : 'Ngày khởi hành'}
              </label>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <input
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold text-[var(--apg-aviation-navy)] outline-none"
                  min={todayYmd}
                  onChange={(event) => onDateChange(event.target.value)}
                  onFocus={(event) => { try { (event.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
                  type="date"
                  value={date}
                />
                {tripType === 'roundtrip' && (
                  <>
                    <span className="text-[var(--apg-text-muted)]">-</span>
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold text-[var(--apg-aviation-navy)] outline-none"
                      min={minReturnDate}
                      onChange={(event) => onReturnDateChange(event.target.value)}
                      onFocus={(event) => { try { (event.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
                      type="date"
                      value={returnDate || defaultReturnDate}
                    />
                  </>
                )}
              </div>
            </div>
            <ChevronDown className="text-[var(--apg-text-muted)]" size={20} strokeWidth={2.2} />
          </div>

          <div className="border-b border-[var(--apg-border-default)] py-1">
            <MobilePassengerCounter
              decrementDisabled={adults <= 1}
              icon={<Users size={21} strokeWidth={2.3} />}
              incrementDisabled={adults + children + infants >= 9}
              label={<>Người lớn <span className="font-normal text-slate-400">(12 tuổi trở lên)</span></>}
              onDecrement={() => onPassengerCountsChange({ adults: adults - 1, children, infants })}
              onIncrement={() => onPassengerCountsChange({ adults: adults + 1, children, infants })}
              value={adults}
            />
            <MobilePassengerCounter
              decrementDisabled={children <= 0}
              incrementDisabled={adults + children + infants >= 9}
              label={<>Trẻ em <span className="font-normal text-slate-400">(2 đến dưới 12 tuổi)</span></>}
              onDecrement={() => onPassengerCountsChange({ adults, children: children - 1, infants })}
              onIncrement={() => onPassengerCountsChange({ adults, children: children + 1, infants })}
              value={children}
            />
            <MobilePassengerCounter
              decrementDisabled={infants <= 0}
              incrementDisabled={infants >= adults || infants >= 4 || adults + children + infants >= 9}
              label={<>Em bé <span className="font-normal text-slate-400">(Dưới 2 tuổi)</span></>}
              onDecrement={() => onPassengerCountsChange({ adults, children, infants: infants - 1 })}
              onIncrement={() => onPassengerCountsChange({ adults, children, infants: infants + 1 })}
              value={infants}
            />
          </div>

          <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--apg-border-default)] px-3 py-3">
            <div />
            <label className="text-[15px] font-semibold text-slate-700">Hạng vé</label>
            <select
              className="h-10 rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-3 text-sm font-bold text-[var(--apg-aviation-navy)] outline-none"
              onChange={(event) => onCabinChange(event.target.value as Cabin)}
              value={cabin}
            >
              <option value="economy">Phổ thông</option>
              <option value="premium">Phổ thông đặc biệt</option>
              <option value="business">Thương gia</option>
              <option value="first">Hạng nhất</option>
            </select>
          </div>

          <button
            className="mt-4 h-12 w-full rounded-[var(--apg-radius-lg)] bg-[var(--apg-aviation-navy)] text-base font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-70"
            disabled={busy}
            onClick={onSearch}
            type="button"
          >
            {busy ? 'Đang tìm' : 'Tìm chuyến bay'}
          </button>
        </div>
      )}

      {isDesktopViewport !== false && (
        <div className="hidden lg:block">
          <div className="mb-4 flex flex-col gap-3 border-b border-[var(--apg-border-default)] pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1.5">
              {(['oneway', 'roundtrip'] as const).map((type) => (
                <button
                  aria-pressed={tripType === type}
                  className={`apg-chip h-10 px-4 text-sm ${tripType === type ? 'apg-chip-active shadow-sm' : ''}`}
                  key={type}
                  onClick={() => onTripTypeChange(type)}
                  type="button"
                >
                  {type === 'oneway' ? 'Một chiều' : 'Khứ hồi'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 grid grid-cols-[1fr_auto_1fr] gap-1.5 lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] lg:gap-3">
            <AirportInput label="Từ" value={fromSel} placeholder="Điểm đi" onSelect={onFromSelect} />
            <button className="apg-btn-secondary mt-6 flex h-11 w-11 shrink-0 items-center justify-center px-0 text-lg text-[var(--apg-brand-gold)] shadow-none lg:mt-7" onClick={onSwapRoute} type="button">⇄</button>
            <AirportInput label="Đến" value={toSel} placeholder="Điểm đến" onSelect={onToSelect} />
          </div>

          <div className="mb-2 grid grid-cols-2 gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3">
            <div>
              <label className="apg-field-label mb-0.5">Ngày đi</label>
              <input className="apg-field px-3 text-sm lg:text-[15px]" type="date" value={date} min={todayYmd} onChange={(event) => onDateChange(event.target.value)} onFocus={(event) => { try { (event.target as HTMLInputElement).showPicker(); } catch { /**/ } }} />
            </div>
            <div>
              <label className="apg-field-label mb-0.5">Ngày về</label>
              <input
                className={`apg-field px-3 text-sm lg:text-[15px] ${tripType === 'oneway' ? 'bg-slate-50 text-slate-300' : ''}`}
                disabled={tripType === 'oneway'}
                min={minReturnDate}
                onChange={(event) => onReturnDateChange(event.target.value)}
                onFocus={(event) => { if (tripType !== 'oneway') try { (event.target as HTMLInputElement).showPicker(); } catch { /**/ } }}
                type="date"
                value={returnDate}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-[var(--apg-border-default)] overflow-hidden rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)]">
            {([
              { key: 'adults', label: 'Người lớn', sub: '12 tuổi+', icon: <Users size={15} strokeWidth={2.3} />, val: adults, decDisabled: adults <= 1, incDisabled: adults + children + infants >= 9, onDec: () => onPassengerCountsChange({ adults: adults - 1, children, infants }), onInc: () => onPassengerCountsChange({ adults: adults + 1, children, infants }) },
              { key: 'children', label: 'Trẻ em', sub: '2-11 tuổi', icon: null, val: children, decDisabled: children <= 0, incDisabled: adults + children + infants >= 9, onDec: () => onPassengerCountsChange({ adults, children: children - 1, infants }), onInc: () => onPassengerCountsChange({ adults, children: children + 1, infants }) },
              { key: 'infants', label: 'Em bé', sub: 'Dưới 2 tuổi', icon: null, val: infants, decDisabled: infants <= 0, incDisabled: infants >= adults || infants >= 4 || adults + children + infants >= 9, onDec: () => onPassengerCountsChange({ adults, children, infants: infants - 1 }), onInc: () => onPassengerCountsChange({ adults, children, infants: infants + 1 }) },
            ] as const).map(({ key, label, sub, icon, val, decDisabled, incDisabled, onDec, onInc }) => (
              <div key={key} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {icon && <span className="text-[var(--apg-text-muted)]">{icon}</span>}
                    <span className="text-[13px] font-semibold text-slate-700">{label}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{sub}</div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button aria-label="Giảm" type="button" disabled={decDisabled} onClick={onDec} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--apg-text-secondary)] transition disabled:text-slate-300 hover:bg-slate-100">
                    <Minus size={14} strokeWidth={2.3} />
                  </button>
                  <span className={`apg-tabular w-6 text-center text-base font-black ${val > 0 ? 'text-[var(--apg-aviation-navy)]' : 'text-slate-300'}`}>{val}</span>
                  <button aria-label="Tăng" type="button" disabled={incDisabled} onClick={onInc} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--apg-text-secondary)] transition disabled:text-slate-300 hover:bg-slate-100">
                    <Plus size={14} strokeWidth={2.3} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-700">Hạng vé</div>
                <div className="text-[11px] text-slate-400">Cabin class</div>
              </div>
              <select
                className="rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] bg-white px-2 py-1 text-[12px] font-bold text-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[rgba(94,114,136,0.15)]"
                onChange={(event) => onCabinChange(event.target.value as Cabin)}
                value={cabin}
              >
                <option value="economy">Phổ thông</option>
                <option value="premium">PT đặc biệt</option>
                <option value="business">Thương gia</option>
                <option value="first">Hạng nhất</option>
              </select>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4">
            <div className="col-span-3 flex flex-wrap items-center gap-1 pr-3">
              {quickRoutes.map(({ from, to }) => (
                <button key={`${from.code}-${to.code}`} type="button" onClick={() => onQuickRouteSelect(from, to)} className="apg-chip h-7 gap-1 px-2.5 text-[10px]">
                  {from.code}-{to.code}
                </button>
              ))}
            </div>
            <button
              aria-label={`Tìm chuyến bay từ ${fromSel?.code ?? ''} đến ${toSel?.code ?? ''} ngày ${date}`}
              className="col-span-1 flex w-full items-center justify-center gap-2 rounded-[var(--apg-radius-md)] py-2 text-sm font-extrabold text-white shadow-[0_6px_18px_rgba(31,95,68,0.32)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
              disabled={busy}
              onClick={onSearch}
              style={{ background: 'linear-gradient(135deg, #1f5f44, var(--apg-success) 55%, #3a9067)' }}
              type="button"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Đang tìm chuyến bay...
                </>
              ) : (
                <>
                  <Plane size={15} strokeWidth={2.3} aria-hidden="true" />
                  Tìm chuyến bay
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="apg-plane-loader mt-3" role="status" aria-live="polite" aria-label="Đang tìm chuyến bay">
          <div className="apg-plane-loader__trail" aria-hidden="true" />
          <svg className="apg-plane-loader__plane" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <g transform="rotate(90 12 12)">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </g>
          </svg>
          <span className="sr-only">{loadingHintText}</span>
        </div>
      )}
      {error && <div className="mt-3 rounded-[var(--apg-radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</div>}
      <div className="mt-2 text-[11px] text-[var(--apg-text-secondary)]">Tối đa 9 hành khách mỗi lần tìm (NL + TE + EB), và EB không được vượt quá NL.</div>
    </div>
  );
}
