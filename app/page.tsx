"use client";
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, CalendarDays, ChevronDown, Minus, Plane, Plus, Users } from 'lucide-react';
import AirportInput from '@/components/AirportInput';
import type { DateStripProps } from '@/components/search/DateStrip';
import type { AirportOption, AirportSelection, Cabin, FlightResult, RoundtripPairOption, SearchResponse } from '@/lib/types';
import { buildAirportSelection, filterAirports, legacyAirportCodeFromText, matchAirport, useAirports } from '@/lib/useAirports';
import { fmtVND, toYmd, hhmm, durationText } from '@/lib/utils';
import { getAirlineMeta } from '@/lib/airlines';
import { buildFlightBadges, minFlightPrice, type FlightBadge } from '@/lib/flight-badges';
import { prefetchAncillaryResponse } from '@/lib/ancillary-cache';

const LOADING_HINTS = [
  'Đang kết nối với Tanphuapg.com',
  'Đang tìm chuyến bay giá tốt',
  'Đang so sánh và lọc kết quả',
  'Sắp xong rồi, vui lòng chờ',
];
const SEARCH_STATE_KEY = 'apg_search_page_state';
const QUICK_ROUTE_CODES: Array<[string, string]> = [
  ['HAN', 'SGN'],
  ['HAN', 'DAD'],
  ['SGN', 'HAN'],
  ['HAN', 'PQC'],
  ['SGN', 'DAD'],
];
const DEFAULT_FROM_SEL: AirportSelection = { code: 'HAN', label: 'Hà Nội (HAN) - Nội Bài' };
const DEFAULT_TO_SEL: AirportSelection = { code: 'SGN', label: 'TP.HCM (SGN) - Tân Sơn Nhất' };

function HomepageDateStripSkeleton() {
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
  loading: () => <HomepageDateStripSkeleton />,
  ssr: false,
});

function airlineColor(code: string) {
  const map: Record<string, string> = {
    VN: '#004b8d',
    VJ: '#e3001b',
    QH: '#00873c',
    BL: '#0050a0',
    VU: '#f5a623',
    '9G': '#ff6600',
    CZ: '#2563eb',
    MU: '#7c3aed',
    CA: '#dc2626',
    ZH: '#0ea5e9',
    '3U': '#ef4444',
  };
  return map[code] ?? '#5e7288';
}

function AirlineLogo({ code, airline, logo, size = 32 }: { code?: string; airline?: string; logo?: string; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [code, airline, logo]);
  const meta = getAirlineMeta(code, airline, logo);
  const displayCode = (meta.code || code || '').slice(0, 2).toUpperCase();
  const bg = airlineColor(displayCode) || airlineColor(String(code || '').toUpperCase());
  if (meta.logo && !imgFailed) return <img src={meta.logo} alt={displayCode||''} width={size} height={size} className="rounded-lg border border-slate-100 bg-white object-contain p-0.5 shadow-sm shrink-0" referrerPolicy="no-referrer" onError={()=>setImgFailed(true)} />;
  return <div style={{ width:size, height:size, backgroundColor:bg }} className="flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white">{displayCode||'✈'}</div>;
}

function FlightBadgePills({ badges, className = '' }: { badges: FlightBadge[]; className?: string }) {
  if (!badges.length) return null;

  const toneClass: Record<FlightBadge['tone'], string> = {
    cheapest: 'border-rose-200 bg-rose-50 text-rose-700',
    business: 'border-amber-200 bg-amber-50 text-amber-800',
    carryOn: 'border-sky-200 bg-sky-50 text-sky-700',
    checked: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${toneClass[badge.tone]}`}
          key={`${badge.key}-${badge.label}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

type FareBreakdown = { baseAmount:number; taxesFees:number; totalAmount:number; currency:'VND' };
type StopFilter = 'all'|'0'|'1'|'2+';
type FilterState = { airlines:string[]; stops:StopFilter };
type RoundtripViewMode = 'pair' | 'legs';
type RoundtripMobileTab = 'outbound' | 'inbound';
type SearchDateOverrides = { date?: string; returnDate?: string; keepResults?: boolean };

function pairSourceLabel(value?: string) {
  const source = String(value || '').trim().toUpperCase();
  if (!source) return '';
  if (/^1[A-Z0-9]$/.test(source)) return source;
  const match = source.match(/(?:^|[^A-Z0-9])(1[A-Z0-9])$/);
  return match ? match[1] : source;
}

function preferredRoundtripPairSourceFilter(_pairs: RoundtripPairOption[]) {
  return 'all';
}

function pairOutboundSignature(flight?: FlightResult | null) {
  if (!flight) return '';
  return [
    flight.flightNumber,
    flight.departure?.airport || '',
    flight.arrival?.airport || '',
    flight.departure?.time || '',
    flight.arrival?.time || '',
    Number(flight.stops || 0),
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .join('|');
}

// Compact Flight Row (mobile-first, Abay style)
function FlightRow({ f, selected, onSelect, onDeselect, btnColor='gold', dense = false, dailyMinPrice }: {
  f: FlightResult; selected: boolean;
  onSelect: () => void; onDeselect?: () => void;
  btnColor?: 'gold'|'blue';
  dense?: boolean;
  dailyMinPrice?: number | null;
}) {
  // Cả 2 chiều dùng cùng vàng amber: outbound = #f59e0b (amber-500),
  // inbound = #d97706 (amber-600) hơi đậm hơn để vẫn có cue phân biệt nhẹ.
  // Pair tốt với navy lạnh, không đụng emerald của sort switch.
  const btnClass = btnColor === 'gold'
    ? 'bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 ring-1 ring-amber-600/30 shadow-[0_1px_2px_rgba(245,158,11,0.35)]'
    : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 ring-1 ring-amber-700/30 shadow-[0_1px_2px_rgba(217,119,6,0.4)]';
  const isLoading = false;
  const selectedBadges = selected ? buildFlightBadges(f, dailyMinPrice) : [];
  return (
    <div className={`border-b border-[var(--apg-border-default)] px-2.5 py-2 transition-colors lg:px-4 lg:py-3 ${selected?'bg-[var(--apg-brand-gold-soft)]':'hover:bg-[var(--apg-bg-surface-soft)]'}`}>
      <div className={`flex ${dense ? 'items-start gap-1' : 'items-center gap-2'}`}>
        {/* Logo */}
        <AirlineLogo code={f.airlineCode} airline={f.airline} logo={f.airlineLogo} size={dense ? 24 : 28} />
        {/* Times + info */}
        <div className="min-w-0 flex-1">
          {dense ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold leading-none text-[var(--apg-aviation-navy)]">{hhmm(f.departure.time)}</span>
              <span className="truncate text-[8px] text-slate-400">{f.flightNumber}</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="text-sm font-bold text-[var(--apg-aviation-navy)] lg:text-base">{hhmm(f.departure.time)}</span>
              <span className="text-[10px] text-[var(--apg-brand-gold)]">→</span>
              <span className="text-sm font-bold text-[var(--apg-aviation-navy)] lg:text-base">{hhmm(f.arrival.time)}</span>
              <span className="text-[10px] text-slate-400 lg:text-[11px]">{durationText(f.duration)}</span>
            </div>
          )}
          <div className={`${dense ? 'mt-0.5 text-[8px]' : 'text-[10px] lg:text-[11px]'} truncate text-slate-400`}>{f.stops===0?'Bay thẳng':`${f.stops} điểm dừng`}</div>
          {dense && !selected && (
            <div className="mt-0.5 flex items-center justify-between gap-1">
              <div className="min-w-0 truncate text-[11px] font-semibold leading-none text-[var(--apg-text-secondary)]">{Math.round(Number(f.fareBreakdown?.totalAmount??f.price.amount)/1000)}K</div>
              <button
                onClick={onSelect}
                className={`min-w-[46px] rounded-md px-2 py-1 text-[10px] font-bold text-white transition-all duration-150 active:scale-95 active:shadow-inner ${btnClass}`}
              >
                Chọn
              </button>
            </div>
          )}
        </div>
        {/* Price + button */}
        {!dense && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="apg-mono text-[15px] font-bold tabular-nums tracking-tight text-[#1a1a1a] lg:text-[16px]">
                  {Number(f.fareBreakdown?.totalAmount??f.price.amount).toLocaleString('vi-VN')}
                </span>
                <span className="text-[11px] font-medium text-slate-400">₫</span>
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-400">≈ ${f.priceUSD}</div>
            </div>
            {selected ? (
              <div className="flex items-center gap-0.5">
                <div className="rounded-md bg-green-600 px-2 py-1 text-[10px] font-bold text-white">✓</div>
                {onDeselect && <button onClick={onDeselect} className="flex h-6 w-6 items-center justify-center rounded-md border border-red-200 bg-red-50 text-[9px] text-red-500 transition-transform duration-150 active:scale-95">✕</button>}
              </div>
            ) : (
              <button onClick={onSelect} className={`rounded-[var(--apg-radius-sm)] px-3 py-1.5 text-xs font-bold text-white transition-all duration-150 active:scale-95 active:shadow-inner ${btnClass}`}>
                Chọn
              </button>
            )}
          </div>
        )}
        {dense && selected && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="text-right text-[11px] font-semibold leading-none text-[var(--apg-text-secondary)]">{Math.round(Number(f.fareBreakdown?.totalAmount??f.price.amount)/1000)}K</div>
            <div className="flex items-center gap-0.5">
              <div className="rounded-md bg-green-600 px-2 py-1 text-[9px] font-bold text-white">✓</div>
              {onDeselect && <button onClick={onDeselect} className="flex h-5 w-5 items-center justify-center rounded-md border border-red-200 bg-red-50 text-[8px] text-red-500 transition-transform duration-150 active:scale-95">✕</button>}
            </div>
          </div>
        )}
      </div>
      {selected && <FlightBadgePills badges={selectedBadges} className="mt-2" />}
      {/* Breakdown when selected */}
      {selected && f.fareBreakdown && (
          <div className="mt-1.5 rounded border border-[var(--apg-border-default)] bg-white px-2 py-1.5 text-[10px]">
          <div className="flex justify-between text-slate-500"><span>Cơ bản</span><span className="font-medium">{fmtVND(f.fareBreakdown.baseAmount)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Thuế + phí</span><span className="font-medium">{fmtVND(f.fareBreakdown.taxesFees)}</span></div>
          <div className="mt-0.5 flex justify-between border-t border-[var(--apg-border-default)] pt-0.5 font-semibold"><span>Tổng</span><span>{fmtVND(f.fareBreakdown.totalAmount)}</span></div>
        </div>
      )}
    </div>
  );
}

function FlightRowSkeleton({ dense = false }: { dense?: boolean }) {
  return (
    <div className="border-b border-[var(--apg-border-default)] px-2.5 py-2 lg:px-4 lg:py-3">
      <div className={`flex ${dense ? 'items-start gap-1' : 'items-center gap-2'}`}>
        <div className={`shrink-0 animate-pulse rounded-lg bg-slate-200/70 ${dense ? 'h-6 w-6' : 'h-7 w-7'}`} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className={`h-3 animate-pulse rounded bg-slate-200/70 ${dense ? 'w-16' : 'w-32 lg:w-44'}`} />
          <div className={`h-2.5 animate-pulse rounded bg-slate-200/50 ${dense ? 'w-12' : 'w-20 lg:w-28'}`} />
        </div>
        <div className={`flex shrink-0 flex-col items-end ${dense ? 'gap-1' : 'gap-1.5'}`}>
          <div className={`h-3 animate-pulse rounded bg-slate-200/70 ${dense ? 'w-10' : 'w-16 lg:w-20'}`} />
          <div className={`animate-pulse rounded-md bg-slate-200/60 ${dense ? 'h-5 w-10' : 'h-7 w-14 lg:w-16'}`} />
        </div>
      </div>
    </div>
  );
}

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

function RouteMismatchNotice({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50/70 px-3 text-amber-700 ${dense ? 'py-1.5 text-[10px]' : 'py-2 text-[11px]'}`}>
      <svg aria-hidden="true" fill="currentColor" height="11" viewBox="0 0 24 24" width="11">
        <path d="M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z" />
      </svg>
      <span>Đã đổi chặng — bấm "Tìm vé" để cập nhật</span>
    </div>
  );
}

// Filter Bar
function FilterBar({
  flights,
  filter,
  onChange,
  sortMode,
  onSortChange,
}: {
  flights: FlightResult[];
  filter: FilterState;
  onChange: (f: FilterState) => void;
  sortMode?: 'price' | 'time';
  onSortChange?: (m: 'price' | 'time') => void;
}) {
  const airlines = useMemo(() => {
    const seen = new Map<string,string>();
    flights.forEach(f => { if (!seen.has(f.airlineCode)) seen.set(f.airlineCode, f.airline); });
    return [...seen.entries()].map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
  }, [flights]);
  if (!flights.length) return null;
  const chip = (active:boolean, onClick:()=>void, label:React.ReactNode) => (
    <button
      onClick={onClick}
      className={`apg-chip h-7 gap-1 px-2.5 text-[10px] ${active ? 'apg-chip-active' : ''}`}
    >
      {label}
    </button>
  );
  const showSort = sortMode !== undefined && onSortChange !== undefined;
  return (
    <div className="border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-2.5 py-2 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {chip(filter.airlines.length===0, ()=>onChange({...filter,airlines:[]}), 'Tất cả HB')}
        {airlines.map(({code,name})=>{
          const active = filter.airlines.includes(code);
          return chip(active, ()=>{
            const next = active ? filter.airlines.filter(c=>c!==code) : [...filter.airlines,code];
            onChange({...filter,airlines:next});
          }, <><AirlineLogo code={code} airline={name} size={14}/>{name.split(' ')[0]}</>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex flex-wrap gap-1">
          {([['all','Tất cả'],['0','Thẳng'],['1','1 dừng'],['2+','2+ dừng']] as [StopFilter,string][]).map(([val,label])=>
            chip(filter.stops===val, ()=>onChange({...filter,stops:val}), label)
          )}
        </div>
        {showSort && (
          <div className="ml-auto flex items-center gap-2 pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--apg-text-muted)]">
              Sắp xếp
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={sortMode === 'time'}
              aria-label={`Đang sắp xếp theo ${sortMode === 'price' ? 'giá' : 'giờ'}, bấm để chuyển sang ${sortMode === 'price' ? 'giờ' : 'giá'}`}
              onClick={() => onSortChange!(sortMode === 'price' ? 'time' : 'price')}
              className="relative inline-flex h-7 w-[88px] shrink-0 items-center rounded-full border border-[var(--apg-border-default)] bg-white p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0.5 left-0.5 w-[42px] rounded-full bg-emerald-500 shadow-[0_1px_2px_rgba(16,185,129,0.45)] ring-1 ring-emerald-600/30 transition-transform duration-200 ease-out ${
                  sortMode === 'time' ? 'translate-x-[42px]' : 'translate-x-0'
                }`}
              />
              <span
                className={`relative z-10 w-[42px] text-center text-[11px] font-bold leading-none transition ${
                  sortMode === 'price' ? 'text-white' : 'text-[var(--apg-text-secondary)]'
                }`}
              >
                Giá
              </span>
              <span
                className={`relative z-10 w-[42px] text-center text-[11px] font-bold leading-none transition ${
                  sortMode === 'time' ? 'text-white' : 'text-[var(--apg-text-secondary)]'
                }`}
              >
                Giờ
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopFilterPanel({
  title,
  subtitle,
  flights,
  filter,
  onChange,
}: {
  title: string;
  subtitle?: string;
  flights: FlightResult[];
  filter: FilterState;
  onChange: (value: FilterState) => void;
}) {
  const airlines = useMemo(() => {
    const seen = new Map<string, string>();
    flights.forEach((flight) => {
      if (!seen.has(flight.airlineCode)) seen.set(flight.airlineCode, flight.airline);
    });
    return [...seen.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [flights]);

  if (!flights.length) return null;

  const chipClass = (active: boolean) => `apg-chip h-9 justify-start rounded-lg px-3 text-xs ${active ? 'apg-chip-active shadow-sm' : ''}`;

  return (
    <aside className="hidden lg:block">
      <div className="space-y-4">
        <div className="apg-panel px-4 py-4">
          <div className="apg-eyebrow">Bộ lọc</div>
          <div className="mt-2 text-base font-black text-[#1a1a1a]">{title}</div>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>

        <div className="apg-panel px-4 py-4">
          <div className="apg-eyebrow">Hãng hàng không</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ ...filter, airlines: [] })}
              className={chipClass(filter.airlines.length === 0)}
            >
              Tất cả
            </button>
            {airlines.map(({ code, name }) => {
              const active = filter.airlines.includes(code);
              return (
                <button
                  key={code}
                  onClick={() => {
                    const next = active ? filter.airlines.filter((item) => item !== code) : [...filter.airlines, code];
                    onChange({ ...filter, airlines: next });
                  }}
                  className={chipClass(active)}
                >
                  <AirlineLogo code={code} airline={name} size={16} />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="apg-panel px-4 py-4">
          <div className="apg-eyebrow">Kiểu hành trình</div>
          <div className="mt-3 grid gap-2">
            {([
              ['all', 'Tất cả'],
              ['0', 'Bay thẳng'],
              ['1', '1 điểm dừng'],
              ['2+', '2+ điểm dừng'],
            ] as [StopFilter, string][]).map(([value, label]) => {
              const active = filter.stops === value;
              return (
                <button
                  key={value}
                  onClick={() => onChange({ ...filter, stops: value })}
                  className={`apg-chip h-10 w-full justify-start rounded-lg px-3 text-left text-sm ${active ? 'apg-chip-active shadow-sm' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SelectedDesktopFlight({
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
    <div className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="apg-display text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>{label}</div>
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
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

function buildPassengerSummary(adults: number, children: number, infants: number) {
  const parts = [`${adults} người lớn`];
  if (children > 0) parts.push(`${children} trẻ em`);
  if (infants > 0) parts.push(`${infants} em bé`);
  return parts.join(' · ');
}

function FloatingQuoteDock({
  tripType,
  onewayFlight,
  outboundFlight,
  inboundFlight,
  onewayDailyMinPrice,
  outboundDailyMinPrice,
  inboundDailyMinPrice,
  total,
  adults,
  children,
  infants,
  bottom,
  dockRef,
  onClear,
  onContinue,
}: {
  tripType: 'oneway' | 'roundtrip';
  onewayFlight: FlightResult | null;
  outboundFlight: FlightResult | null;
  inboundFlight: FlightResult | null;
  onewayDailyMinPrice?: number | null;
  outboundDailyMinPrice?: number | null;
  inboundDailyMinPrice?: number | null;
  total: number;
  adults: number;
  children: number;
  infants: number;
  bottom: number;
  dockRef: Ref<HTMLDivElement>;
  onClear: () => void;
  onContinue: () => void;
}) {
  const passengerSummary = buildPassengerSummary(adults, children, infants);
  const perTravelerLabel = children > 0 || infants > 0 ? 'Tạm tính theo cấu hình hiện tại' : `${adults} người lớn`;
  const totalLabel = fmtVND(total * adults);

  const SummaryLine = ({
    label,
    flight,
    accent,
    dailyMinPrice,
    compact = false,
  }: {
    label: string;
    flight: FlightResult;
    accent: string;
    dailyMinPrice?: number | null;
    compact?: boolean;
  }) => {
    const amount = flight.fareBreakdown?.totalAmount ?? flight.price.amount;
    const badges = buildFlightBadges(flight, dailyMinPrice);
    const airlineAccent = airlineColor(flight.airlineCode || '') || accent;
    const tileBackground = `linear-gradient(135deg, color-mix(in srgb, var(--apg-aviation-navy) 4%, white), color-mix(in srgb, ${airlineAccent} 10%, white) 56%, color-mix(in srgb, ${airlineAccent} 18%, white))`;
    const headerBackground = `linear-gradient(135deg, color-mix(in srgb, var(--apg-aviation-navy) 84%, ${airlineAccent}), color-mix(in srgb, ${airlineAccent} 62%, var(--apg-aviation-navy)))`;

    if (compact) {
      return (
        <div
          className="rounded-2xl border border-[var(--apg-border-default)] px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          style={{ background: tileBackground }}
        >
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5"
            style={{ background: headerBackground }}
          >
            <div className="apg-display text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.96)' }}>
              {label}
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/80" />
          </div>
          <div className="flex items-center gap-3">
            <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={22} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#1a1a1a]">
                {flight.flightNumber} · {hhmm(flight.departure.time)} → {hhmm(flight.arrival.time)}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {flight.airline} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}
              </div>
              <FlightBadgePills badges={badges} className="mt-1.5" />
            </div>
            <div className="text-right">
              <div className="apg-tabular text-[13px] font-black text-[#1a1a1a]">{fmtVND(amount)}</div>
              <div className="text-[10px] text-slate-400">/người</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex min-w-0 items-center gap-3 rounded-[16px] border border-[var(--apg-border-default)] px-3.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm"
        style={{ background: tileBackground }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={24} />
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: headerBackground }}
            >
              <div className="apg-display truncate text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.96)' }}>
                {label}
              </div>
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
            </div>
            <div className="truncate text-[13px] font-bold leading-tight text-[#1a1a1a]">
              {flight.flightNumber} · {hhmm(flight.departure.time)} → {hhmm(flight.arrival.time)}
            </div>
            <div className="truncate text-[11px] leading-tight text-slate-500">
              {flight.airline} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}
            </div>
            <FlightBadgePills badges={badges} className="mt-1.5" />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="apg-tabular text-[14px] font-black text-[#1a1a1a]">{fmtVND(amount)}</div>
          <div className="text-[10px] text-slate-400">/người</div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="pointer-events-none fixed left-0 z-40 w-full px-0 transition-[bottom,opacity,transform] duration-300"
      style={{ bottom }}
    >
      <div className="pointer-events-auto mx-auto max-w-[1440px] px-3 lg:px-6 xl:px-8" ref={dockRef}>
        <div className="overflow-hidden rounded-[24px] border border-[var(--apg-border-default)] bg-white/88 shadow-[0_20px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="border-b border-[var(--apg-border-default)] bg-white/78 px-4 py-2.5 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="apg-eyebrow">Tổng tạm tính</div>
                <div className="mt-1 truncate text-[11px] text-slate-500">{passengerSummary}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--apg-text-secondary)]">
                  {tripType === 'oneway' ? 'Một chiều' : 'Khứ hồi'}
                </div>
                <button
                  aria-label="Đóng tổng tạm tính và bỏ chọn chuyến bay"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--apg-border-default)] bg-white text-[12px] font-black text-[var(--apg-text-secondary)] shadow-sm transition hover:bg-[var(--apg-bg-surface-soft)] active:scale-95"
                  onClick={onClear}
                  type="button"
                >
                  X
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 px-3 py-3 lg:hidden">
            {tripType === 'oneway' && onewayFlight ? <SummaryLine label="Một chiều" flight={onewayFlight} accent="var(--apg-text-secondary)" dailyMinPrice={onewayDailyMinPrice} compact /> : null}

            {tripType === 'roundtrip' && outboundFlight && inboundFlight ? (
              <div className="grid gap-2.5">
                <SummaryLine label="Chiều đi" flight={outboundFlight} accent="var(--apg-text-secondary)" dailyMinPrice={outboundDailyMinPrice} compact />
                <SummaryLine label="Chiều về" flight={inboundFlight} accent="var(--apg-route-inbound)" dailyMinPrice={inboundDailyMinPrice} compact />
              </div>
            ) : null}

            <div
              className="rounded-[20px] border border-[#1f5f44] px-4 py-4 text-white shadow-[0_14px_28px_rgba(46,125,91,0.30)]"
              style={{ background: 'linear-gradient(135deg, #1f5f44, var(--apg-success) 55%, #3a9067)' }}
            >
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="apg-eyebrow">Tổng tạm tính</div>
                  <div className="mt-1 text-[11px] text-white/70">{perTravelerLabel}</div>
                </div>
                <div className="text-right">
                  <div className="apg-tabular text-[28px] font-black leading-none text-white">{totalLabel}</div>
                  <div className="mt-1 text-[10px] text-white/65">Đã gồm giá các chuyến đã chọn</div>
                </div>
              </div>
              <button
                className="mt-3 h-11 w-full rounded-[14px] bg-white text-sm font-bold text-[#1f5f44] shadow-[0_8px_18px_rgba(255,255,255,0.14)] transition hover:bg-emerald-50"
                onClick={onContinue}
              >
                Tiếp tục báo giá →
              </button>
            </div>
          </div>

          <div className="hidden items-center gap-3 px-3 py-2.5 lg:flex">
            <div className={`grid min-w-0 flex-1 gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {tripType === 'oneway' && onewayFlight ? <SummaryLine label="Một chiều" flight={onewayFlight} accent="var(--apg-text-secondary)" dailyMinPrice={onewayDailyMinPrice} /> : null}
              {tripType === 'roundtrip' && outboundFlight ? <SummaryLine label="Chiều đi" flight={outboundFlight} accent="var(--apg-text-secondary)" dailyMinPrice={outboundDailyMinPrice} /> : null}
              {tripType === 'roundtrip' && inboundFlight ? <SummaryLine label="Chiều về" flight={inboundFlight} accent="var(--apg-route-inbound)" dailyMinPrice={inboundDailyMinPrice} /> : null}
            </div>
            <div
              className="w-[308px] shrink-0 rounded-[20px] border border-[#1f5f44] px-4 py-3 text-white shadow-[0_14px_28px_rgba(46,125,91,0.26)]"
              style={{ background: 'linear-gradient(135deg, #1f5f44, var(--apg-success) 55%, #3a9067)' }}
            >
              <div className="apg-eyebrow text-white/65">Tổng tạm tính</div>
              <div className="apg-tabular mt-1.5 text-[32px] font-black leading-none text-white">{totalLabel}</div>
              <div className="mt-1.5 text-[13px] text-white/80">{passengerSummary}</div>
              <button
                className="mt-3 h-10 w-full rounded-[14px] bg-white text-sm font-bold text-[#1f5f44] shadow-[0_8px_18px_rgba(255,255,255,0.14)] transition hover:bg-emerald-50"
                onClick={onContinue}
              >
                Tiếp tục báo giá →
              </button>
            </div>
          </div>
        </div>
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
        type="button"
        onClick={() => onChange('all')}
        className={`apg-chip h-8 px-3 text-xs ${activeSource === 'all' ? 'apg-chip-active shadow-sm' : ''}`}
      >
        Tất cả cặp
      </button>
      {sources.map(({ source, count }) => (
        <button
          key={source}
          type="button"
          onClick={() => onChange(source)}
          className={`apg-chip h-8 px-3 text-xs ${activeSource === source ? 'apg-chip-active shadow-sm' : ''}`}
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
  onSelect,
}: {
  pair: RoundtripPairOption;
  selected: boolean;
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
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
        selected ? 'border-[var(--apg-aviation-navy-mid)] bg-[var(--apg-bg-surface-soft)]' : 'border-[var(--apg-border-default)]'
      }`}
    >
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
        <button type="button" onClick={onSelect} className="apg-btn-primary h-10 px-4 text-sm font-bold text-white">
          Chọn cặp này
        </button>
      </div>
    </div>
  );
}

function applyFilter(flights:FlightResult[], f:FilterState) {
  return flights.filter(fl => {
    if (f.airlines.length>0 && !f.airlines.includes(fl.airlineCode)) return false;
    if (f.stops==='0' && fl.stops!==0) return false;
    if (f.stops==='1' && fl.stops!==1) return false;
    if (f.stops==='2+' && fl.stops<2) return false;
    return true;
  });
}

function localTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizePassengerCounts(input: { adults: number; children: number; infants: number }) {
  let adults = Math.max(1, Math.min(9, Number(input.adults) || 1));
  let children = Math.max(0, Math.min(9, Number(input.children) || 0));
  let infants = Math.max(0, Math.min(4, Number(input.infants) || 0));

  if (infants > adults) infants = adults;

  let overflow = adults + children + infants - 9;
  if (overflow > 0) {
    const cutChildren = Math.min(children, overflow);
    children -= cutChildren;
    overflow -= cutChildren;
    if (overflow > 0) infants = Math.max(0, infants - overflow);
  }

  if (infants > adults) infants = adults;
  return { adults, children, infants };
}

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
                onMouseDown={(event) => {
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

// Main
export default function HomePage() {
  const router = useRouter();
  const { airports } = useAirports();
  const footerRef = useRef<HTMLElement | null>(null);
  const floatingQuoteDockRef = useRef<HTMLDivElement | null>(null);
  const todayYmd = useMemo(() => localTodayYmd(), []);
  const [fromSel, setFromSel] = useState<AirportSelection | null>(DEFAULT_FROM_SEL);
  const [toSel, setToSel] = useState<AirportSelection | null>(DEFAULT_TO_SEL);
  const [date, setDate] = useState(toYmd(7));
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType]     = useState<'oneway'|'roundtrip'>('oneway');
  const [adults, setAdults]     = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants]   = useState(0);
  const [cabin, setCabin]       = useState<Cabin>('economy');
  const [loading, setLoading]   = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [resultsGen, setResultsGen]   = useState(0);
  const [searchedRoute, setSearchedRoute] = useState<{from:string;to:string;tripType:'oneway'|'roundtrip'}|null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [error, setError]       = useState('');
  const [results, setResults]   = useState<FlightResult[]>([]);
  const [meta, setMeta]         = useState<SearchResponse['metadata']|null>(null);
  const [outboundResults, setOutboundResults] = useState<FlightResult[]>([]);
  const [inboundResults, setInboundResults]   = useState<FlightResult[]>([]);
  const [pairOptions, setPairOptions] = useState<RoundtripPairOption[]>([]);
  const [selectedOutbound, setSelectedOutbound] = useState<FlightResult|null>(null);
  const [selectedInbound, setSelectedInbound]   = useState<FlightResult|null>(null);
  const [selectedOneway, setSelectedOneway]     = useState<FlightResult|null>(null);
  const [selectedPairId, setSelectedPairId] = useState('');
  const [roundtripViewMode, setRoundtripViewMode] = useState<RoundtripViewMode>('legs');
  const [mobileRoundtripTab, setMobileRoundtripTab] = useState<RoundtripMobileTab>('outbound');
  const [pairSourceFilter, setPairSourceFilter] = useState('all');
  const [sortOneway, setSortOneway] = useState<'price'|'time'>('price');
  const [sortDepart, setSortDepart] = useState<'price'|'time'>('price');
  const [sortReturn, setSortReturn] = useState<'price'|'time'>('price');
  const [detailLoadingId, setDetailLoadingId] = useState<string|null>(null);
  const [loadingHintIdx, setLoadingHintIdx] = useState(0);
  const [loadingDots, setLoadingDots]       = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);
  const [floatingQuoteDockBottom, setFloatingQuoteDockBottom] = useState(16);
  const [floatingQuoteDockHeight, setFloatingQuoteDockHeight] = useState(0);
  const emptyFilter: FilterState = {airlines:[],stops:'all'};
  const [filterOneway,   setFilterOneway]   = useState<FilterState>(emptyFilter);
  const [filterOutbound, setFilterOutbound] = useState<FilterState>(emptyFilter);
  const [filterInbound,  setFilterInbound]  = useState<FilterState>(emptyFilter);

  const resolveSelection = (code: string, label: string, fallback: AirportSelection): AirportSelection => {
    return buildAirportSelection(airports, code || fallback.code, label || fallback.label) || fallback;
  };

  const quickRoutes = useMemo(() => QUICK_ROUTE_CODES.map(([from, to]) => ({
    from: buildAirportSelection(airports, from, from) || { code: from, label: from },
    to: buildAirportSelection(airports, to, to) || { code: to, label: to },
  })), [airports]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const nextFrom = s?.fromSel?.code
          ? resolveSelection(String(s.fromSel.code || ''), String(s.fromSel.label || ''), DEFAULT_FROM_SEL)
          : resolveSelection(
              legacyAirportCodeFromText(String(s?.fromInput || '')) || String(s?.from || '') || DEFAULT_FROM_SEL.code,
              String(s?.fromInput || ''),
              DEFAULT_FROM_SEL,
            );
        const nextTo = s?.toSel?.code
          ? resolveSelection(String(s.toSel.code || ''), String(s.toSel.label || ''), DEFAULT_TO_SEL)
          : resolveSelection(
              legacyAirportCodeFromText(String(s?.toInput || '')) || String(s?.to || '') || DEFAULT_TO_SEL.code,
              String(s?.toInput || ''),
              DEFAULT_TO_SEL,
            );

        const pax = normalizePassengerCounts({
          adults: Number(s?.adults ?? 1),
          children: Number(s?.children ?? 0),
          infants: Number(s?.infants ?? 0),
        });

        setFromSel(nextFrom);
        setToSel(nextTo);
        setDate(String(s?.date || toYmd(7)));
        setReturnDate(String(s?.returnDate || ''));
        setTripType(s?.tripType === 'roundtrip' ? 'roundtrip' : 'oneway');
        setAdults(pax.adults);
        setChildren(pax.children);
        setInfants(pax.infants);
        setCabin((s?.cabin || 'economy') as Cabin);
        setResults(s?.results ?? []);
        setMeta(s?.meta ?? null);
        setOutboundResults(s?.outboundResults ?? []);
        setInboundResults(s?.inboundResults ?? []);
        setPairOptions(s?.pairOptions ?? []);
        setSelectedOutbound(s?.selectedOutbound ?? null);
        setSelectedInbound(s?.selectedInbound ?? null);
        setSelectedOneway(s?.selectedOneway ?? null);
        setSelectedPairId(String(s?.selectedPairId || ''));
        setRoundtripViewMode(s?.roundtripViewMode === 'pair' ? 'pair' : 'legs');
        setPairSourceFilter(String(s?.pairSourceFilter || 'all'));
        // Migration: nếu user còn state cũ với 'sortMode' duy nhất → áp cho cả 3 lane.
        const legacySort = s?.sortMode === 'time' ? 'time' : (s?.sortMode === 'price' ? 'price' : null);
        const pickSort = (raw: unknown): 'price' | 'time' =>
          raw === 'time' ? 'time' : raw === 'price' ? 'price' : (legacySort ?? 'price');
        setSortOneway(pickSort(s?.sortOneway));
        setSortDepart(pickSort(s?.sortDepart));
        setSortReturn(pickSort(s?.sortReturn));
        // Restore searchedRoute để biết kết quả persist thuộc chặng nào.
        // Legacy data không có field này → mặc định coi như khớp với chặng hiện tại.
        if (s?.searchedRoute && typeof s.searchedRoute === 'object') {
          setSearchedRoute({
            from: String(s.searchedRoute.from || ''),
            to: String(s.searchedRoute.to || ''),
            tripType: s.searchedRoute.tripType === 'roundtrip' ? 'roundtrip' : 'oneway',
          });
        } else if ((s?.results?.length || s?.outboundResults?.length || s?.inboundResults?.length || s?.pairOptions?.length)) {
          setSearchedRoute({
            from: String(nextFrom.code || ''),
            to: String(nextTo.code || ''),
            tripType: s?.tripType === 'roundtrip' ? 'roundtrip' : 'oneway',
          });
        }
      }
    } catch {
      /**/
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!airports.length) return;
    setFromSel((prev) => {
      if (!prev?.code) return prev;
      const next = buildAirportSelection(airports, prev.code, prev.label);
      return next && (next.code !== prev.code || next.label !== prev.label) ? next : prev;
    });
    setToSel((prev) => {
      if (!prev?.code) return prev;
      const next = buildAirportSelection(airports, prev.code, prev.label);
      return next && (next.code !== prev.code || next.label !== prev.label) ? next : prev;
    });
  }, [airports]);

  // Fire-and-forget warm-up khi user vừa mở trang: backend sẽ kiểm tra/refresh
  // session và nạp tỷ giá trước. Giúp lần bấm "Tìm vé" đầu tiên khỏi gánh cold-login.
  // Dedup qua sessionStorage để reload/nav nội trang không gọi trùng.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const WARMED_KEY = 'apg_warmed_at';
    const WARMUP_TTL_MS = 60_000;
    try {
      const last = Number(sessionStorage.getItem(WARMED_KEY) || '0');
      if (Number.isFinite(last) && Date.now() - last < WARMUP_TTL_MS) return;
    } catch {/**/ }

    const started = Date.now();
    Promise.allSettled([
      fetch('/api/warmup', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/exchange-rate', { cache: 'no-store' }),
    ]).then(([warm]) => {
      try { sessionStorage.setItem(WARMED_KEY, String(Date.now())); } catch {/**/ }
      if (warm.status === 'fulfilled' && warm.value) {
        const { ready, warming } = warm.value as { ready?: boolean; warming?: boolean };
        console.debug(`[warmup] ready=${ready} warming=${warming} elapsed=${Date.now() - started}ms`);
      }
    }).catch(() => {/* warmup never breaks UI */});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
        fromSel,
        toSel,
        from: fromSel?.code || '',
        to: toSel?.code || '',
        date,
        returnDate,
        tripType,
        adults,
        children,
        infants,
        cabin,
        results,
        meta,
        outboundResults,
        inboundResults,
        pairOptions,
        selectedOutbound,
        selectedInbound,
        selectedOneway,
        selectedPairId,
        roundtripViewMode,
        pairSourceFilter,
        sortOneway,
        sortDepart,
        sortReturn,
        searchedRoute,
      }));
    } catch {/**/ }
  }, [hydrated, fromSel, toSel, date, returnDate, tripType, adults, children, infants, cabin, results, meta, outboundResults, inboundResults, pairOptions, selectedOutbound, selectedInbound, selectedOneway, selectedPairId, roundtripViewMode, pairSourceFilter, sortOneway, sortDepart, sortReturn, searchedRoute]);

  useEffect(() => {
    if (!loading) { setLoadingHintIdx(0); setLoadingDots(''); return; }
    const dot  = setInterval(()=>setLoadingDots(d=>d.length>=3?'':d+'.'),350);
    const hint = setInterval(()=>setLoadingHintIdx(i=>(i+1)%LOADING_HINTS.length),1800);
    return ()=>{ clearInterval(dot); clearInterval(hint); };
  }, [loading]);

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const mobileMedia = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => {
      setIsDesktopViewport(desktopMedia.matches);
      setIsMobileViewport(mobileMedia.matches);
    };

    syncViewport();
    desktopMedia.addEventListener('change', syncViewport);
    mobileMedia.addEventListener('change', syncViewport);

    return () => {
      desktopMedia.removeEventListener('change', syncViewport);
      mobileMedia.removeEventListener('change', syncViewport);
    };
  }, []);

  function sortFlights(arr:FlightResult[], mode:'price'|'time'='price') {
    const copy=[...arr];
    if (mode==='time') copy.sort((a,b)=>+new Date(a.departure.time)-+new Date(b.departure.time));
    else copy.sort((a,b)=>a.price.amount-b.price.amount);
    return copy;
  }

  function sortPairResults(arr: RoundtripPairOption[], mode:'price'|'time'='price') {
    const copy = [...arr];
    if (mode === 'time') copy.sort((a, b) => +new Date(a.outbound.departure.time) - +new Date(b.outbound.departure.time));
    else copy.sort((a, b) => a.totalAmount - b.totalAmount);
    return copy;
  }

  const sortedOneway   = useMemo(()=>applyFilter(sortFlights(results, sortOneway),filterOneway),[results,sortOneway,filterOneway]);
  const sortedOutbound = useMemo(() => {
    if (tripType === 'roundtrip' && roundtripViewMode === 'pair' && pairOptions.length > 0) return [];
    return applyFilter(sortFlights(outboundResults, sortDepart), filterOutbound);
  }, [tripType, roundtripViewMode, pairOptions.length, outboundResults, sortDepart, filterOutbound]);
  const sortedInbound  = useMemo(() => {
    if (tripType === 'roundtrip' && roundtripViewMode === 'pair' && pairOptions.length > 0) return [];
    return applyFilter(sortFlights(inboundResults, sortReturn), filterInbound);
  }, [tripType, roundtripViewMode, pairOptions.length, inboundResults, sortReturn, filterInbound]);
  const pairSources = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    const counts = new Map<string, number>();
    pairOptions.forEach((pair) => {
      const source = pairSourceLabel(pair.source || pair.systemName);
      if (!source) return;
      counts.set(source, (counts.get(source) || 0) + 1);
    });
    return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => a.source.localeCompare(b.source));
  }, [tripType, pairOptions]);
  const sourceScopedPairOptions = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    return pairSourceFilter === 'all'
      ? pairOptions
      : pairOptions.filter((pair) => pairSourceLabel(pair.source || pair.systemName) === pairSourceFilter);
  }, [tripType, pairOptions, pairSourceFilter]);
  const pairAnchorSignature = useMemo(() => {
    if (tripType !== 'roundtrip' || pairSourceFilter === 'all' || sourceScopedPairOptions.length === 0) return '';
    const selectedSignature = pairOutboundSignature(selectedOutbound);
    if (selectedSignature && sourceScopedPairOptions.some((pair) => pairOutboundSignature(pair.outbound) === selectedSignature)) {
      return selectedSignature;
    }

    const directPairs = sourceScopedPairOptions.filter((pair) => Number(pair.outbound.stops || 0) === 0);
    const pool = directPairs.length ? directPairs : sourceScopedPairOptions;
    const anchor = [...pool].sort((a, b) => {
      const outboundAmountA = Number(a.outbound.fareBreakdown?.totalAmount ?? a.outbound.price.amount ?? a.totalAmount);
      const outboundAmountB = Number(b.outbound.fareBreakdown?.totalAmount ?? b.outbound.price.amount ?? b.totalAmount);
      if (outboundAmountA !== outboundAmountB) return outboundAmountA - outboundAmountB;
      if (a.totalAmount !== b.totalAmount) return a.totalAmount - b.totalAmount;
      return +new Date(a.outbound.departure.time) - +new Date(b.outbound.departure.time);
    })[0];
    return pairOutboundSignature(anchor?.outbound);
  }, [tripType, pairSourceFilter, sourceScopedPairOptions, selectedOutbound]);
  const pairAnchorFlight = useMemo(() => {
    if (!pairAnchorSignature) return null;
    return sourceScopedPairOptions.find((pair) => pairOutboundSignature(pair.outbound) === pairAnchorSignature)?.outbound || null;
  }, [sourceScopedPairOptions, pairAnchorSignature]);
  const visiblePairOptions = useMemo(() => {
    if (tripType !== 'roundtrip' || pairOptions.length === 0) return [];
    let filtered = sourceScopedPairOptions;
    if (pairAnchorSignature) {
      const anchored = filtered.filter((pair) => pairOutboundSignature(pair.outbound) === pairAnchorSignature);
      if (anchored.length) filtered = anchored;
    }
    // Pair view neo theo chiều đi nên dùng sort của chiều đi.
    return sortPairResults(filtered, sortDepart);
  }, [tripType, pairOptions, sourceScopedPairOptions, pairAnchorSignature, sortDepart]);
  const visibleResultCount = useMemo(() => {
    if (tripType === 'oneway') return meta?.totalResults ?? results.length;
    if (roundtripViewMode === 'pair' && pairOptions.length > 0) return visiblePairOptions.length;
    return outboundResults.length + inboundResults.length;
  }, [tripType, roundtripViewMode, pairOptions.length, visiblePairOptions.length, outboundResults.length, inboundResults.length, meta?.totalResults, results.length]);
  const totalPairCount = meta?.pairCount ?? pairOptions.length;
  const pairLoadedNotice = totalPairCount > pairOptions.length ? ` · tổng ${totalPairCount} cặp` : '';
  const totalRoundtrip = useMemo(()=>(selectedOutbound?.fareBreakdown?.totalAmount??selectedOutbound?.price.amount??0)+(selectedInbound?.fareBreakdown?.totalAmount??selectedInbound?.price.amount??0),[selectedOutbound,selectedInbound]);
  const totalOneway = useMemo(()=>selectedOneway?.fareBreakdown?.totalAmount??selectedOneway?.price.amount??0,[selectedOneway]);
  const onewayDailyMinPrice = useMemo(() => minFlightPrice(results), [results]);
  const outboundDailyMinPrice = useMemo(
    () => minFlightPrice(outboundResults.length ? outboundResults : pairOptions.map((pair) => pair.outbound)),
    [outboundResults, pairOptions]
  );
  const inboundDailyMinPrice = useMemo(
    () => minFlightPrice(inboundResults.length ? inboundResults : pairOptions.map((pair) => pair.inbound)),
    [inboundResults, pairOptions]
  );
  const minReturnDate = useMemo(() => (date && date > todayYmd ? date : todayYmd), [date, todayYmd]);
  const defaultReturnDate = useMemo(() => {
    const fallback = toYmd(10);
    return fallback >= minReturnDate ? fallback : minReturnDate;
  }, [minReturnDate]);
  const fromCode = fromSel?.code || '';
  const toCode = toSel?.code || '';

  useEffect(() => {
    if (!date || date < todayYmd) setDate(todayYmd);
  }, [date, todayYmd]);

  useEffect(() => {
    if (returnDate && returnDate < minReturnDate) setReturnDate(minReturnDate);
  }, [returnDate, minReturnDate]);

  useEffect(() => {
    if (pairSourceFilter === 'all') return;
    if (!pairSources.some((item) => item.source === pairSourceFilter)) {
      setPairSourceFilter('all');
    }
  }, [pairSourceFilter, pairSources]);

  const applyPassengerCounts = (next: { adults: number; children: number; infants: number }) => {
    const normalized = normalizePassengerCounts(next);
    setAdults(normalized.adults);
    setChildren(normalized.children);
    setInfants(normalized.infants);
  };

  // Prefetch ancillaries (hành lý) ngay khi user đã chọn đủ chuyến trên /search.
  // Khi qua /quote → bấm "Giữ chỗ" → modal có data sẵn (cache 120s in-memory).
  // Throttle: chỉ trigger khi state ổn định 350ms để tránh prefetch khi user đang spam click.
  useEffect(() => {
    if (!fromCode || !toCode) return;

    let payload: Parameters<typeof prefetchAncillaryResponse>[0] | null = null;

    if (tripType === 'oneway' && selectedOneway) {
      payload = {
        flight: selectedOneway,
        outbound: selectedOneway,
        inbound: null,
        tripType: 'oneway',
        search: { from: fromCode, to: toCode, date },
        adults, children, infants, cabin,
      };
    } else if (tripType === 'roundtrip' && selectedOutbound && selectedInbound) {
      payload = {
        flight: selectedOutbound,
        outbound: selectedOutbound,
        inbound: selectedInbound,
        tripType: 'roundtrip',
        search: { from: fromCode, to: toCode, date, returnDate: returnDate || toYmd(10) },
        adults, children, infants, cabin,
      };
    }

    if (!payload) return;
    const captured = payload;
    const t = window.setTimeout(() => prefetchAncillaryResponse(captured), 350);
    return () => window.clearTimeout(t);
  }, [tripType, selectedOneway, selectedOutbound, selectedInbound, fromCode, toCode, date, returnDate, adults, children, infants, cabin]);

  function goQuote(outbound:FlightResult, inbound?:FlightResult) {
    localStorage.setItem('apg_quote_selection', JSON.stringify({
      tripType: inbound ? 'roundtrip' : 'oneway',
      outbound,
      inbound,
      adults,
      children,
      infants,
      cabin,
      search: { from: fromCode, to: toCode, date, returnDate: returnDate || toYmd(10) },
      createdAt: new Date().toISOString(),
    }));
    router.push('/quote');
  }

  function selectRoundtripPair(pair: RoundtripPairOption) {
    setSelectedPairId(pair.id);
    setSelectedOutbound(pair.outbound);
    setSelectedInbound(pair.inbound);
    // Bỏ auto-navigate — user phải bấm thủ công "Tiếp tục báo giá"
  }

  async function selectFlight(flight:FlightResult, dir:'outbound'|'inbound'|'oneway') {
    setDetailLoadingId(flight.id);
    if (dir !== 'oneway') setSelectedPairId('');
    try {
      let e={...flight};
      if (!e.fareBreakdown && e.detailUrl) {
        try {
          const r=await fetch('/api/fare-detail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({detailUrl:e.detailUrl})});
          const j=await r.json();
          if(r.ok&&j.fareBreakdown){const fb=j.fareBreakdown as FareBreakdown;e={...e,fareBreakdown:fb,price:{...e.price,amount:fb.totalAmount}};}
        } catch {/**/ }
      }
      if (!e.fareBreakdown) e={...e,fareBreakdown:{baseAmount:e.price.amount,taxesFees:0,totalAmount:e.price.amount,currency:'VND'}};
      // Bỏ auto-navigate sang báo giá — user vẫn bấm thủ công "Tiếp tục báo giá".
      if (dir==='outbound'){setOutboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedOutbound(e);setMobileRoundtripTab('inbound');}
      else if(dir==='inbound'){setInboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedInbound(e);}
      else {setResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedOneway(e);}
    } catch(ex:unknown){setError(ex instanceof Error?ex.message:'Lỗi');}
    finally{setDetailLoadingId(null);}
  }

  async function callSearch(payload:Record<string,unknown>, signal?: AbortSignal):Promise<SearchResponse> {
    const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
    const j=await r.json();
    if(!r.ok)throw new Error(j.details ? `${j.error}: ${j.details}` : (j.error||'Lỗi'));
    return j as SearchResponse;
  }

  async function search(overrides: SearchDateOverrides = {}) {
    const searchDate = overrides.date ?? date;
    const searchReturnDate = overrides.returnDate ?? returnDate;
    const keepResults = !!overrides.keepResults;

    // Hủy fetch trước đó nếu user đổi ngày liên tục → tránh race condition
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    if (keepResults) {
      // Stale-while-revalidate: KHÔNG clear list cũ, chỉ bật cờ reloading
      setIsReloading(true);
      setError('');
    } else {
      setLoading(true);setError('');setResults([]);setMeta(null);
      setOutboundResults([]);setInboundResults([]);setPairOptions([]);
      setSelectedOutbound(null);setSelectedInbound(null);setSelectedOneway(null);setSelectedPairId('');setPairSourceFilter('all');setMobileRoundtripTab('outbound');
      setFilterOneway(emptyFilter);setFilterOutbound(emptyFilter);setFilterInbound(emptyFilter);
    }
    try {
      if (!fromCode || !toCode) throw new Error('Vui lòng chọn sân bay đi và sân bay đến hợp lệ.');
      if (fromCode === toCode) throw new Error('Điểm đi và điểm đến không được giống nhau.');
      if (searchDate < todayYmd) throw new Error('Ngày đi phải từ hôm nay trở đi.');
      if (infants > adults) throw new Error('Số em bé không được vượt quá số người lớn.');
      if (adults + children + infants > 9) throw new Error('Tổng số hành khách tối đa 9.');
      const base={adults,children,infants,cabin};
      if (tripType==='roundtrip') {
        const eff=searchReturnDate||toYmd(10);
        if (eff < searchDate) throw new Error('Ngày về phải từ ngày đi trở đi.');
        const rt=await callSearch({...base,from:fromCode,to:toCode,date:searchDate,returnDate:eff,tripType:'roundtrip'}, controller.signal);
        if (controller.signal.aborted) return;
        const hasRoundtripShape = Array.isArray(rt.departureResults) || Array.isArray(rt.returnResults) || Array.isArray(rt.pairOptions);
        if (hasRoundtripShape) {
          const departure = Array.isArray(rt.departureResults) ? rt.departureResults : rt.results || [];
          const returns = Array.isArray(rt.returnResults) ? rt.returnResults : [];
          const pairs = Array.isArray(rt.pairOptions) ? rt.pairOptions : [];
          setOutboundResults(departure);
          setInboundResults(returns);
          setPairOptions(pairs);
          setRoundtripViewMode(pairs.length > 0 ? 'pair' : 'legs');
          if (!keepResults) setPairSourceFilter(preferredRoundtripPairSourceFilter(pairs));
          setMeta(rt.metadata || null);
          // Validate selection cũ còn tồn tại trong data mới
          if (keepResults) {
            setSelectedOutbound(prev => prev && departure.find(f => f.id === prev.id) ? prev : null);
            setSelectedInbound(prev => prev && returns.find(f => f.id === prev.id) ? prev : null);
            if (pairs.length === 0) setSelectedPairId('');
          }
        } else {
          const go=await callSearch({...base,from:fromCode,to:toCode,date:searchDate,tripType:'oneway'}, controller.signal);
          if (controller.signal.aborted) return;
          const back=await callSearch({...base,from:toCode,to:fromCode,date:eff,tripType:'oneway'}, controller.signal);
          if (controller.signal.aborted) return;
          const goResults = go.results||[];
          const backResults = back.results||[];
          setOutboundResults(goResults);setInboundResults(backResults);
          setMeta({
            totalResults: goResults.length + backResults.length,
            departureCount: goResults.length,
            returnCount: backResults.length,
            searchTime: +(((go.metadata?.searchTime || 0) + (back.metadata?.searchTime || 0))).toFixed(1),
          });
          setRoundtripViewMode('legs');
          if (keepResults) {
            setSelectedOutbound(prev => prev && goResults.find(f => f.id === prev.id) ? prev : null);
            setSelectedInbound(prev => prev && backResults.find(f => f.id === prev.id) ? prev : null);
          }
        }
      } else {
        const one=await callSearch({...base,from:fromCode,to:toCode,date:searchDate,tripType:'oneway'}, controller.signal);
        if (controller.signal.aborted) return;
        const oneResults = one.results||[];
        setResults(oneResults);setMeta(one.metadata || null);
        if (keepResults) {
          setSelectedOneway(prev => prev && oneResults.find(f => f.id === prev.id) ? prev : null);
        }
      }
      // Ghi nhận chặng vừa search xong để biết kết quả hiện tại thuộc route nào
      setSearchedRoute({ from: fromCode, to: toCode, tripType });
      // Trigger animation re-fire khi có data mới (cả search lần đầu lẫn đổi ngày)
      setResultsGen(g => g + 1);
    } catch(ex:unknown){
      if (ex instanceof DOMException && ex.name === 'AbortError') return;
      setError(ex instanceof Error?ex.message:'Lỗi tìm kiếm.');
    }
    finally{
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsReloading(false);
      }
    }
  }

  const hasResults = tripType==='oneway'
    ? results.length>0
    : (outboundResults.length>0||inboundResults.length>0||pairOptions.length>0);

  // Kết quả hiện tại có khớp với form đang nhập không?
  // Mismatch (đổi sân bay / đổi tripType) → render skeleton thay vì list cũ.
  // Đổi ngày KHÔNG ảnh hưởng đến match (date dùng SWR riêng giữ list cũ).
  const routeMatchesResults = !!searchedRoute
    && searchedRoute.from === fromCode
    && searchedRoute.to === toCode
    && searchedRoute.tripType === tripType;
  const showFloatingQuoteDock = routeMatchesResults
    && (
      (tripType === 'oneway' && !!selectedOneway) ||
      (tripType === 'roundtrip' && !!selectedOutbound && !!selectedInbound)
    );

  function selectDepartDate(nextDate: string) {
    const adjustedReturnDate = tripType === 'roundtrip' && returnDate && returnDate < nextDate ? nextDate : returnDate;

    setDate(nextDate);
    if (adjustedReturnDate !== returnDate) setReturnDate(adjustedReturnDate);
    if (hasResults) void search({ date: nextDate, returnDate: adjustedReturnDate, keepResults: true });
  }

  function selectReturnDate(nextDate: string) {
    setReturnDate(nextDate);
    if (hasResults) void search({ returnDate: nextDate, keepResults: true });
  }

  const mobileRoundtripLeg = mobileRoundtripTab === 'outbound'
    ? {
        label: 'Chiều đi',
        shortLabel: 'Đi',
        route: `${fromCode} → ${toCode}`,
        dateLabel: date,
        countLabel: routeMatchesResults ? `${sortedOutbound.length}/${outboundResults.length}` : '—/—',
        flights: outboundResults,
        sortedFlights: sortedOutbound,
        filter: filterOutbound,
        setFilter: setFilterOutbound,
        sortMode: sortDepart,
        setSortMode: setSortDepart,
        selectedFlight: selectedOutbound,
        clearSelected: () => setSelectedOutbound(null),
        selectDir: 'outbound' as const,
        btnColor: 'gold' as const,
        dailyMinPrice: outboundDailyMinPrice,
        gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))',
        dateStrip: {
          destination: toCode,
          direction: 'depart' as const,
          origin: fromCode,
          selectedDate: date,
          onSelect: selectDepartDate,
        },
      }
    : {
        label: 'Chiều về',
        shortLabel: 'Về',
        route: `${toCode} → ${fromCode}`,
        dateLabel: returnDate || toYmd(10),
        countLabel: routeMatchesResults ? `${sortedInbound.length}/${inboundResults.length}` : '—/—',
        flights: inboundResults,
        sortedFlights: sortedInbound,
        filter: filterInbound,
        setFilter: setFilterInbound,
        sortMode: sortReturn,
        setSortMode: setSortReturn,
        selectedFlight: selectedInbound,
        clearSelected: () => setSelectedInbound(null),
        selectDir: 'inbound' as const,
        btnColor: 'blue' as const,
        dailyMinPrice: inboundDailyMinPrice,
        gradient: 'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))',
        dateStrip: {
          destination: fromCode,
          direction: 'return' as const,
          origin: toCode,
          selectedDate: returnDate || toYmd(10),
          onSelect: selectReturnDate,
        },
      };

  useEffect(() => {
    if (!showFloatingQuoteDock) {
      setFloatingQuoteDockHeight(0);
      return;
    }

    const node = floatingQuoteDockRef.current;
    if (!node) return;

    const syncHeight = () => {
      setFloatingQuoteDockHeight(node.getBoundingClientRect().height);
    };

    syncHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showFloatingQuoteDock, tripType, selectedOneway, selectedOutbound, selectedInbound, adults, children, infants, totalOneway, totalRoundtrip]);

  useEffect(() => {
    if (!showFloatingQuoteDock) {
      setFloatingQuoteDockBottom(16);
      return;
    }

    let frame = 0;
    const baseGap = isDesktopViewport ? 20 : 12;

    const syncBottom = () => {
      frame = 0;
      if (typeof window === 'undefined') return;
      const footerTop = footerRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const overlap = Math.max(0, window.innerHeight - footerTop);
      setFloatingQuoteDockBottom(baseGap + overlap);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncBottom);
    };

    syncBottom();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [showFloatingQuoteDock, isDesktopViewport]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--apg-bg-page)' }}>
      <div className="mx-auto max-w-[1440px] lg:px-6 lg:pb-8 xl:px-8">

        {/* Header */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex w-full items-center gap-4 overflow-hidden border border-[var(--apg-aviation-navy)] px-4 py-3 text-left shadow-sm lg:mt-4 lg:rounded-t-[var(--apg-radius-lg)] lg:px-5 lg:py-4"
          style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}
        >
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-[60px] lg:w-[60px]">
            <img src="/assets/tanphu-apg-logo.jpg" alt="Logo" className="h-10 w-10 rounded-[8px] object-contain lg:h-[46px] lg:w-[46px]"
            onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
          </div>
          <div>
            <div className="apg-display text-[15px] font-semibold tracking-[0.08em] text-white lg:text-[18px]">TAN PHU APG</div>
            <div className="text-[10px] tracking-[0.04em] text-white/70 lg:text-[11px]">Corporate Aviation Services</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-left text-[11px] text-white/70 lg:block">
              <div className="apg-display text-[10px] font-medium tracking-[0.2em] text-white/60">BOOKING DESK</div>
              <div className="apg-mono mt-0.5 font-semibold text-white/90">{fromCode || '---'} → {toCode || '---'}</div>
            </div>
            {meta && !loading && (
              <div className="rounded-[var(--apg-radius-md)] border border-white/10 bg-white/10 px-3 py-2 text-right">
                <div className="apg-display text-[10px] font-medium tracking-[0.16em] text-white/70">Tìm thấy</div>
                <div className="apg-tabular text-base font-black text-white lg:text-[28px] lg:leading-none">{visibleResultCount}</div>
                <div className="text-[10px] font-semibold text-white/80">chuyến</div>
              </div>
            )}
          </div>
        </button>

        {/* Search form - compact */}
        <div
          className="border border-t-0 border-[var(--apg-border-default)] bg-white px-3 py-3 shadow-sm lg:rounded-b-[var(--apg-radius-lg)] lg:px-5 lg:py-4"
        >
          <div className="lg:hidden">
            <div className="grid grid-cols-2 rounded-[var(--apg-radius-md)] border border-[var(--apg-aviation-navy)] bg-white p-0.5">
              {(['oneway','roundtrip'] as const).map(t=>(
                <button
                  aria-pressed={tripType===t}
                  key={t}
                  onClick={()=>{
                    setTripType(t);
                    if (t === 'roundtrip' && !returnDate) setReturnDate(defaultReturnDate);
                  }}
                  className={`h-9 rounded-[var(--apg-radius-sm)] text-sm font-bold transition ${
                    tripType===t
                      ? 'bg-[var(--apg-aviation-navy)] text-white shadow-sm'
                      : 'text-[var(--apg-text-secondary)]'
                  }`}
                  type="button"
                >
                  {t==='oneway'?'Một chiều':'Khứ hồi'}
                </button>
              ))}
            </div>

            <div className="relative mt-3 overflow-visible border-y border-[var(--apg-border-default)] bg-white">
              <MobileAirportPicker
                airports={airports}
                icon={<Plane size={22} strokeWidth={2.4} />}
                label="Khởi hành"
                onSelect={setFromSel}
                placeholder="Chọn điểm đi"
                value={fromSel}
              />
              <button
                aria-label="Đổi chiều hành trình"
                className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--apg-border-default)] bg-white text-[var(--apg-aviation-navy)] shadow-[0_10px_24px_rgba(15,47,75,0.12)] transition active:scale-95"
                onClick={()=>{const currentFrom = fromSel; setFromSel(toSel); setToSel(currentFrom);}}
                type="button"
              >
                <ArrowUpDown size={20} strokeWidth={2.4} />
              </button>
              <MobileAirportPicker
                airports={airports}
                label="Điểm đến"
                onSelect={setToSel}
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
                    onChange={e=>setDate(e.target.value)}
                    onFocus={e=>{try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}
                    type="date"
                    value={date}
                  />
                  {tripType === 'roundtrip' && (
                    <>
                      <span className="text-[var(--apg-text-muted)]">-</span>
                      <input
                        className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold text-[var(--apg-aviation-navy)] outline-none"
                        min={minReturnDate}
                        onChange={e=>setReturnDate(e.target.value)}
                        onFocus={e=>{try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}
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
                onDecrement={()=>applyPassengerCounts({ adults: adults - 1, children, infants })}
                onIncrement={()=>applyPassengerCounts({ adults: adults + 1, children, infants })}
                value={adults}
              />
              <MobilePassengerCounter
                decrementDisabled={children <= 0}
                incrementDisabled={adults + children + infants >= 9}
                label={<>Trẻ em <span className="font-normal text-slate-400">(2 đến dưới 12 tuổi)</span></>}
                onDecrement={()=>applyPassengerCounts({ adults, children: children - 1, infants })}
                onIncrement={()=>applyPassengerCounts({ adults, children: children + 1, infants })}
                value={children}
              />
              <MobilePassengerCounter
                decrementDisabled={infants <= 0}
                incrementDisabled={infants >= adults || infants >= 4 || adults + children + infants >= 9}
                label={<>Em bé <span className="font-normal text-slate-400">(Dưới 2 tuổi)</span></>}
                onDecrement={()=>applyPassengerCounts({ adults, children, infants: infants - 1 })}
                onIncrement={()=>applyPassengerCounts({ adults, children, infants: infants + 1 })}
                value={infants}
              />
            </div>

            <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--apg-border-default)] px-3 py-3">
              <div />
              <label className="text-[15px] font-semibold text-slate-700">Hạng vé</label>
              <select
                className="h-10 rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-3 text-sm font-bold text-[var(--apg-aviation-navy)] outline-none"
                onChange={e=>setCabin(e.target.value as Cabin)}
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
              disabled={loading||isReloading}
              onClick={() => search()}
              type="button"
            >
              {loading||isReloading?'Đang tìm':'Tìm chuyến bay'}
            </button>
          </div>

          <div className="hidden lg:block">
          {/* Trip type — sort đã chuyển vào từng FilterBar theo lane */}
          <div className="mb-4 flex flex-col gap-3 border-b border-[var(--apg-border-default)] pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1.5">
              {(['oneway','roundtrip'] as const).map(t=>(
                <button
                  aria-pressed={tripType===t}
                  key={t}
                  onClick={()=>{
                    setTripType(t);
                    if (t === 'roundtrip' && !returnDate) setReturnDate(defaultReturnDate);
                  }}
                  className={`apg-chip h-10 px-4 text-sm ${tripType===t?'apg-chip-active shadow-sm':''}`}>
                  {t==='oneway'?'Một chiều':'Khứ hồi'}
                </button>
              ))}
            </div>
          </div>

          {/* Route */}
          <div className="mb-2 grid grid-cols-[1fr_auto_1fr] gap-1.5 lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] lg:gap-3">
            <AirportInput label="Từ" value={fromSel} placeholder="Điểm đi" onSelect={setFromSel}/>
            <button className="apg-btn-secondary mt-6 flex h-11 w-11 shrink-0 items-center justify-center px-0 text-lg text-[var(--apg-brand-gold)] shadow-none lg:mt-7"
              onClick={()=>{const currentFrom = fromSel; setFromSel(toSel); setToSel(currentFrom);}}>⇄</button>
            <AirportInput label="Đến" value={toSel} placeholder="Điểm đến" onSelect={setToSel}/>
          </div>

          {/* Dates */}
          <div className="mb-2 grid grid-cols-2 gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3">
            <div>
              <label className="apg-field-label mb-0.5">Ngày đi</label>
              <input className="apg-field px-3 text-sm lg:text-[15px]" type="date" value={date} min={todayYmd} onChange={e=>setDate(e.target.value)} onFocus={e=>{try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}/>
            </div>
            <div>
              <label className="apg-field-label mb-0.5">Ngày về</label>
              <input className={`apg-field px-3 text-sm lg:text-[15px] ${tripType==='oneway'?'bg-slate-50 text-slate-300':''}`}
                type="date" value={returnDate} min={minReturnDate} onChange={e=>setReturnDate(e.target.value)} disabled={tripType==='oneway'} onFocus={e=>{if(tripType!=='oneway')try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}/>
            </div>
          </div>

          {/* Passengers + Cabin + Search */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 lg:grid-cols-[140px_180px_180px_auto] lg:gap-3">
            <div>
              <label className="apg-field-label mb-0.5">NL</label>
              <input className="apg-field apg-tabular px-2 text-center text-sm" type="number" min={1} max={9} value={adults} onChange={e=>applyPassengerCounts({ adults: Number(e.target.value || 1), children, infants })}/>
            </div>
            <div>
              <label className="apg-field-label mb-0.5">TE + EB</label>
              <div className="grid h-[44px] grid-cols-2 gap-1 rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] p-1 lg:h-12">
                <input className="h-full w-full rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] bg-white px-1 py-1.5 text-center text-sm text-[var(--apg-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(94,114,136,0.12)]" type="number" min={0} max={9} value={children} onChange={e=>applyPassengerCounts({ adults, children: Number(e.target.value || 0), infants })} placeholder="TE"/>
                <input className="h-full w-full rounded-[var(--apg-radius-sm)] border border-[var(--apg-border-default)] bg-white px-1 py-1.5 text-center text-sm text-[var(--apg-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(94,114,136,0.12)]" type="number" min={0} max={4} value={infants} onChange={e=>applyPassengerCounts({ adults, children, infants: Number(e.target.value || 0) })} placeholder="EB"/>
              </div>
            </div>
            <div>
              <label className="apg-field-label mb-0.5">Hạng</label>
              <select className="apg-field px-3 text-sm" value={cabin} onChange={e=>setCabin(e.target.value as Cabin)}>
                <option value="economy">PT</option>
                <option value="premium">PT+</option>
                <option value="business">TG</option>
                <option value="first">HN</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="apg-btn-primary h-[44px] w-full text-base font-extrabold shadow-sm lg:h-12"
                style={{minWidth:'96px'}} onClick={() => search()} disabled={loading||isReloading}>
                {loading||isReloading?'Đang tìm':'Tìm vé'}
              </button>
            </div>
          </div>

          {/* Quick routes */}
          <div className="mt-2 flex flex-wrap gap-1">
            {quickRoutes.map(({ from, to })=>(
              <button key={`${from.code}-${to.code}`} onClick={()=>{setFromSel(from);setToSel(to);}}
                className="apg-chip h-7 gap-1 px-2.5 text-[10px]">
                {from.code}-{to.code}
              </button>
            ))}
          </div>
          </div>

          {loading && (
            <div className="apg-plane-loader mt-3" role="status" aria-live="polite" aria-label="Đang tìm chuyến bay">
              <div className="apg-plane-loader__trail" aria-hidden="true" />
              <svg className="apg-plane-loader__plane" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <g transform="rotate(90 12 12)">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                </g>
              </svg>
              <span className="sr-only">{LOADING_HINTS[loadingHintIdx]}{loadingDots}</span>
            </div>
          )}
          {error && <div className="mt-3 rounded-[var(--apg-radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</div>}
          <div className="mt-2 text-[11px] text-[var(--apg-text-secondary)]">Tối đa 9 hành khách mỗi lần tìm (NL + TE + EB), và EB không được vượt quá NL.</div>
        </div>

        {/* One-way results */}
        {tripType==='oneway' && results.length>0 && (
          <>
          <div className="overflow-hidden bg-white shadow-sm lg:hidden" style={{border:'1px solid var(--apg-border-default)'}}>
            <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-white" style={{background:'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))'}}>
              <span>✈ {fromCode} → {toCode} · {date}</span>
              <span className="text-white/70 font-normal">{routeMatchesResults ? `${sortedOneway.length}/${results.length}` : '—/—'}</span>
            </div>
            {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
            {isDesktopViewport === false && (
              <DateStrip
                className="rounded-none border-x-0 border-t-0 shadow-none"
                destination={toCode}
                direction="depart"
                origin={fromCode}
                selectedDate={date}
                onSelect={selectDepartDate}
              />
            )}
            {routeMatchesResults ? (
              <>
                <FilterBar flights={results} filter={filterOneway} onChange={setFilterOneway} sortMode={sortOneway} onSortChange={setSortOneway}/>
                <div className="max-h-[60vh] overflow-auto">
                  {sortedOneway.length>0 ? sortedOneway.map((f,i)=>(
                    <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                      <FlightRow f={f} selected={selectedOneway?.id===f.id}
                        onSelect={()=>selectFlight(f,'oneway')}
                        onDeselect={selectedOneway?.id===f.id?()=>setSelectedOneway(null):undefined}
                        dailyMinPrice={onewayDailyMinPrice}
                        btnColor="gold"/>
                    </div>
                  )) : <div className="p-3 text-xs text-slate-500 text-center">Không có chuyến phù hợp.</div>}
                </div>
              </>
            ) : (
              <>
                <RouteMismatchNotice />
                <div className="max-h-[60vh] overflow-auto">
                  {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i}/>))}
                </div>
              </>
            )}
          </div>
          <div className="hidden lg:block lg:pt-6">
            <section className="overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white shadow-sm">
              <div className="border-b border-[var(--apg-border-default)] bg-white">
                <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid))' }}>
                  <div className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">Một chiều</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="apg-display text-[24px] font-semibold text-white">{fromCode} → {toCode}</div>
                    <div className="apg-tabular text-sm font-semibold text-white/90">{routeMatchesResults ? `${sortedOneway.length}/${results.length}` : '—/—'}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-white/80">
                    <span>{date}</span>
                    <span>{routeMatchesResults ? (meta?.searchTime ? `${meta.searchTime.toFixed(1)}s` : 'Tìm kiếm trực tiếp') : 'Chưa cập nhật'}</span>
                  </div>
                </div>
                {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
                {isDesktopViewport === true && (
                  <DateStrip
                    className="rounded-none border-x-0 border-t-0 shadow-none"
                    destination={toCode}
                    direction="depart"
                    origin={fromCode}
                    selectedDate={date}
                    onSelect={selectDepartDate}
                  />
                )}
                {routeMatchesResults && (
                  <FilterBar flights={results} filter={filterOneway} onChange={setFilterOneway} sortMode={sortOneway} onSortChange={setSortOneway}/>
                )}
              </div>
              {routeMatchesResults ? (
                <div>
                  {sortedOneway.length>0 ? sortedOneway.map((f,i)=>(
                    <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                      <FlightRow f={f} selected={selectedOneway?.id===f.id}
                        onSelect={()=>selectFlight(f,'oneway')}
                        onDeselect={selectedOneway?.id===f.id?()=>setSelectedOneway(null):undefined}
                        dailyMinPrice={onewayDailyMinPrice}
                        btnColor="gold"/>
                    </div>
                  )) : <div className="p-6 text-sm text-slate-500 text-center">Không có chuyến phù hợp.</div>}
                </div>
              ) : (
                <>
                  <RouteMismatchNotice />
                  <div>
                    {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i}/>))}
                  </div>
                </>
              )}
            </section>
          </div>
          </>
        )}

        {/* Roundtrip - 2 cột như Abay */}
        {tripType==='roundtrip' && (outboundResults.length>0||inboundResults.length>0||pairOptions.length>0) && (
          <div>
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
                        key={value}
                        type="button"
                        onClick={() => setRoundtripViewMode(value)}
                        className={`rounded-[var(--apg-radius-sm)] px-3 py-2 text-xs font-semibold transition-all ${
                          roundtripViewMode === value
                            ? 'bg-[var(--apg-aviation-navy)] text-white shadow-sm'
                            : 'text-[var(--apg-text-secondary)] hover:bg-white'
                        }`}
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
                          ? `${visiblePairOptions.length}/${sourceScopedPairOptions.length || pairOptions.length} cặp hiển thị${pairLoadedNotice} · ${date} - ${returnDate || toYmd(10)}`
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
                      onChange={setPairSourceFilter}
                    />
                  </div>
                </div>

                {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
                {!routeMatchesResults && <RouteMismatchNotice />}
                <div className="space-y-4">
                  {!routeMatchesResults ? (
                    Array.from({length:3}).map((_,i)=>(<RoundtripPairCardSkeleton key={i}/>))
                  ) : visiblePairOptions.length > 0 ? visiblePairOptions.map((pair, i) => (
                    <div key={`${resultsGen}-${pair.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                      <RoundtripPairCard
                        pair={pair}
                        selected={selectedPairId === pair.id}
                        onSelect={() => selectRoundtripPair(pair)}
                      />
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-[var(--apg-border-default)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                      Không có cặp khứ hồi phù hợp với bộ lọc nguồn hiện tại.
                    </div>
                  )}
                </div>
              </div>
            )}

            {roundtripViewMode === 'legs' && (
              <>
            {/* Mobile tabs */}
            <div className="overflow-hidden bg-white shadow-sm md:hidden" style={{border:'1px solid var(--apg-border-default)'}}>
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
                          active
                            ? 'text-white shadow-sm'
                            : 'text-[var(--apg-text-secondary)] hover:bg-white'
                        }`}
                        key={tab.value}
                        onClick={() => setMobileRoundtripTab(tab.value)}
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
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              tab.selected ? 'bg-emerald-400' : active ? 'bg-white/55' : 'bg-slate-300'
                            }`}
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

              <div className="px-3 py-2 text-xs font-bold text-white" style={{background: mobileRoundtripLeg.gradient}}>
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
                    onChange={mobileRoundtripLeg.setFilter}
                    sortMode={mobileRoundtripLeg.sortMode}
                    onSortChange={mobileRoundtripLeg.setSortMode}
                  />
                  <div className="max-h-[60vh] overflow-auto">
                    {mobileRoundtripLeg.sortedFlights.length>0 ? mobileRoundtripLeg.sortedFlights.map((f,i)=>(
                      <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                        <FlightRow f={f} selected={mobileRoundtripLeg.selectedFlight?.id===f.id}
                          onSelect={()=>selectFlight(f,mobileRoundtripLeg.selectDir)}
                          onDeselect={mobileRoundtripLeg.selectedFlight?.id===f.id?mobileRoundtripLeg.clearSelected:undefined}
                          dailyMinPrice={mobileRoundtripLeg.dailyMinPrice}
                          btnColor={mobileRoundtripLeg.btnColor}/>
                      </div>
                    )) : <div className="p-3 text-center text-xs text-slate-500">Không có chuyến phù hợp.</div>}
                  </div>
                </>
              ) : (
                <>
                  <RouteMismatchNotice />
                  <div className="max-h-[60vh] overflow-auto">
                    {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i}/>))}
                  </div>
                </>
              )}
            </div>

            {/* Tablet 2-column flight lists */}
            <div className="hidden grid-cols-2 gap-0 bg-white md:grid lg:hidden" style={{border:'1px solid var(--apg-border-default)'}}>
              {/* Outbound */}
              <div style={{borderRight:'1px solid var(--apg-border-default)'}}>
                <div className="px-1.5 py-2 text-center text-[10px] font-bold text-white" style={{background:'linear-gradient(135deg, var(--apg-aviation-navy), var(--apg-aviation-navy-mid))'}}>
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
                    onSelect={selectDepartDate}
                  />
                )}
                {routeMatchesResults ? (
                  <>
                    <FilterBar flights={outboundResults} filter={filterOutbound} onChange={setFilterOutbound} sortMode={sortDepart} onSortChange={setSortDepart}/>
                    <div className="max-h-[55vh] overflow-auto">
                      {sortedOutbound.length>0 ? sortedOutbound.map((f,i)=>(
                        <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                          <FlightRow f={f} selected={selectedOutbound?.id===f.id}
                            onSelect={()=>selectFlight(f,'outbound')}
                            onDeselect={selectedOutbound?.id===f.id?()=>setSelectedOutbound(null):undefined}
                            dailyMinPrice={outboundDailyMinPrice}
                            btnColor="gold" dense/>
                        </div>
                      )) : <div className="p-3 text-[10px] text-slate-400 text-center">Không có.</div>}
                    </div>
                  </>
                ) : (
                  <>
                    <RouteMismatchNotice dense/>
                    <div className="max-h-[55vh] overflow-auto">
                      {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i} dense/>))}
                    </div>
                  </>
                )}
              </div>

              {/* Inbound */}
              <div>
                <div className="px-1.5 py-2 text-center text-[10px] font-bold text-white" style={{background:'linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, var(--apg-route-inbound) 72%, var(--apg-aviation-navy)))'}}>
                  <div className="truncate">Về: {toCode}→{fromCode}</div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] font-normal text-white/80">
                    <span>{returnDate||toYmd(10)}</span>
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
                    selectedDate={returnDate || toYmd(10)}
                    onSelect={selectReturnDate}
                  />
                )}
                {routeMatchesResults ? (
                  <>
                    <FilterBar flights={inboundResults} filter={filterInbound} onChange={setFilterInbound} sortMode={sortReturn} onSortChange={setSortReturn}/>
                    <div className="max-h-[55vh] overflow-auto">
                      {sortedInbound.length>0 ? sortedInbound.map((f,i)=>(
                        <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                          <FlightRow f={f} selected={selectedInbound?.id===f.id}
                            onSelect={()=>selectFlight(f,'inbound')}
                            onDeselect={selectedInbound?.id===f.id?()=>setSelectedInbound(null):undefined}
                            dailyMinPrice={inboundDailyMinPrice}
                            btnColor="blue" dense/>
                        </div>
                      )) : <div className="p-3 text-[10px] text-slate-400 text-center">Không có.</div>}
                    </div>
                  </>
                ) : (
                  <>
                    <RouteMismatchNotice dense/>
                    <div className="max-h-[55vh] overflow-auto">
                      {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i} dense/>))}
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
                      onSelect={selectDepartDate}
                    />
                  )}
                  {routeMatchesResults && selectedOutbound && (
                    <div className="px-4 py-4">
                      <SelectedDesktopFlight label="Đã chọn" flight={selectedOutbound} accent="var(--apg-text-secondary)" dailyMinPrice={outboundDailyMinPrice} />
                    </div>
                  )}
                  {routeMatchesResults && (
                    <FilterBar flights={outboundResults} filter={filterOutbound} onChange={setFilterOutbound} sortMode={sortDepart} onSortChange={setSortDepart}/>
                  )}
                </div>
                {routeMatchesResults ? (
                  <div>
                    {sortedOutbound.length>0 ? sortedOutbound.map((f,i)=>(
                      <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                        <FlightRow f={f} selected={selectedOutbound?.id===f.id}
                          onSelect={()=>selectFlight(f,'outbound')}
                          onDeselect={selectedOutbound?.id===f.id?()=>setSelectedOutbound(null):undefined}
                          dailyMinPrice={outboundDailyMinPrice}
                          btnColor="gold" />
                      </div>
                    )) : <div className="p-6 text-sm text-slate-500 text-center">Không có chuyến phù hợp.</div>}
                  </div>
                ) : (
                  <>
                    <RouteMismatchNotice />
                    <div>
                      {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i}/>))}
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
                    <div className="mt-1 text-xs text-white/80">{returnDate||toYmd(10)}</div>
                  </div>
                  {isReloading && <div className="apg-reload-bar" aria-hidden="true" />}
                  {isDesktopViewport === true && (
                    <DateStrip
                      className="rounded-none border-x-0 border-t-0 shadow-none"
                      destination={fromCode}
                      direction="return"
                      origin={toCode}
                      selectedDate={returnDate || toYmd(10)}
                      onSelect={selectReturnDate}
                    />
                  )}
                  {routeMatchesResults && selectedInbound && (
                    <div className="px-4 py-4">
                      <SelectedDesktopFlight label="Đã chọn" flight={selectedInbound} accent="var(--apg-route-inbound)" dailyMinPrice={inboundDailyMinPrice} />
                    </div>
                  )}
                  {routeMatchesResults && (
                    <FilterBar flights={inboundResults} filter={filterInbound} onChange={setFilterInbound} sortMode={sortReturn} onSortChange={setSortReturn}/>
                  )}
                </div>
                {routeMatchesResults ? (
                  <div>
                    {sortedInbound.length>0 ? sortedInbound.map((f,i)=>(
                      <div key={`${resultsGen}-${f.id}`} className="apg-row-in" style={{animationDelay:`${Math.min(i,8)*35}ms`}}>
                        <FlightRow f={f} selected={selectedInbound?.id===f.id}
                          onSelect={()=>selectFlight(f,'inbound')}
                          onDeselect={selectedInbound?.id===f.id?()=>setSelectedInbound(null):undefined}
                          dailyMinPrice={inboundDailyMinPrice}
                          btnColor="blue" />
                      </div>
                    )) : <div className="p-6 text-sm text-slate-500 text-center">Không có chuyến phù hợp.</div>}
                  </div>
                ) : (
                  <>
                    <RouteMismatchNotice />
                    <div>
                      {Array.from({length:5}).map((_,i)=>(<FlightRowSkeleton key={i}/>))}
                    </div>
                  </>
                )}
              </section>
            </div>

              </>
            )}
          </div>
        )}

        {showFloatingQuoteDock && (
          <FloatingQuoteDock
            tripType={tripType}
            onewayFlight={selectedOneway}
            outboundFlight={selectedOutbound}
            inboundFlight={selectedInbound}
            onewayDailyMinPrice={onewayDailyMinPrice}
            outboundDailyMinPrice={outboundDailyMinPrice}
            inboundDailyMinPrice={inboundDailyMinPrice}
            total={tripType === 'oneway' ? totalOneway : totalRoundtrip}
            adults={adults}
            children={children}
            infants={infants}
            bottom={floatingQuoteDockBottom}
            dockRef={floatingQuoteDockRef}
            onClear={() => {
              setSelectedOneway(null);
              setSelectedOutbound(null);
              setSelectedInbound(null);
              setSelectedPairId('');
              setMobileRoundtripTab('outbound');
            }}
            onContinue={() => {
              if (tripType === 'oneway' && selectedOneway) {
                goQuote(selectedOneway);
                return;
              }
              if (tripType === 'roundtrip' && selectedOutbound && selectedInbound) {
                goQuote(selectedOutbound, selectedInbound);
              }
            }}
          />
        )}

        <div
          aria-hidden="true"
          className="transition-[height] duration-300"
          style={{ height: showFloatingQuoteDock ? floatingQuoteDockHeight + 24 : 0 }}
        />

        {/* Footer */}
        <footer
          ref={footerRef}
          className="overflow-hidden border border-t-0 border-[var(--apg-aviation-navy)] text-white shadow-sm lg:rounded-b-[var(--apg-radius-lg)]"
          style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}
        >
          {/* Mobile compact footer */}
          <div className="border-b border-white/10 px-4 py-3 md:hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <img
                  src="/assets/tanphu-apg-logo.jpg"
                  alt="Logo"
                  className="h-7 w-7 rounded-[6px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div className="min-w-0 flex-1 text-[10px] leading-relaxed text-white/78">
                <div className="apg-display text-[11px] font-semibold tracking-[0.08em] text-white">TAN PHU APG</div>
                <div className="truncate text-[9px] text-white/62">A member of Tan Phu Auto Transport Cooperative</div>
                <div className="mt-2 grid gap-1.5">
                  <a href="tel:0918752686" className="inline-flex min-w-0 items-center gap-1.5 text-white/82">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-white/55">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span className="uppercase tracking-[0.12em] text-white/50">Hotline</span>
                    <span className="apg-mono font-semibold text-white">0918.752.686</span>
                  </a>
                  <div className="flex min-w-0 items-start gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="mt-[3px] shrink-0 text-white/55">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <div className="min-w-0">
                      <span className="uppercase tracking-[0.12em] text-white/50">Trụ sở chính</span>
                      <span className="text-white/82"> · Thái Nguyên · Tổ 9, Phường Tích Lương</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 1: Brand + Hotline */}
          <div className="hidden flex-col gap-4 border-b border-white/10 px-4 py-5 md:flex lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-6">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-[52px] lg:w-[52px]">
                <img
                  src="/assets/tanphu-apg-logo.jpg"
                  alt="Logo"
                  className="h-9 w-9 rounded-[8px] object-contain lg:h-10 lg:w-10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <div className="apg-display text-[14px] font-semibold tracking-[0.08em] text-white lg:text-[16px]">TAN PHU APG</div>
                <div className="text-[10px] leading-snug tracking-[0.04em] text-white/70 lg:text-[11px]">A member of Tan Phu Auto Transport Cooperative</div>
              </div>
            </div>
            <a
              href="tel:0918752686"
              className="inline-flex items-center gap-3 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 transition hover:border-white/25 hover:bg-white/15 lg:self-auto"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-white/80">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <div className="text-left">
                <div className="apg-display text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">Hotline</div>
                <div className="apg-mono text-sm font-semibold tabular-nums text-white">0918.752.686</div>
              </div>
            </a>
          </div>

          {/* Tier 2: Offices */}
          <div className="hidden gap-3 px-4 py-5 md:grid md:grid-cols-2 lg:grid-cols-4 lg:gap-4 lg:px-6 lg:py-6">
            {([
              { eyebrow: 'Trụ sở chính', city: 'Thái Nguyên', address: 'Tổ 9, Phường Tích Lương, Tỉnh Thái Nguyên' },
              { eyebrow: 'Chi nhánh', city: 'Hà Nội', address: '323 Xuân Đỉnh, TP Hà Nội' },
              { eyebrow: 'Chi nhánh', city: 'Khánh Hòa', address: 'Phường Nha Trang, Tỉnh Khánh Hòa' },
              { eyebrow: 'Chi nhánh', city: 'Phú Thọ', address: 'Phường Phúc Yên, Tỉnh Phú Thọ' },
            ] as const).map((office) => (
              <div
                key={office.city}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.09]"
              >
                <div className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-white/55">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span className="apg-display text-[9px] font-medium uppercase tracking-[0.18em] text-white/60">{office.eyebrow}</span>
                </div>
                <div className="mt-1 apg-display text-sm font-semibold text-white">{office.city}</div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-white/75">{office.address}</div>
              </div>
            ))}
          </div>

          {/* Tier 3: Copyright */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-white/10 bg-black/15 px-4 py-2.5 text-center text-[10px] text-white/85 lg:px-6 lg:py-3">
            <span>© 2026 TAN PHU APG</span>
            <span className="text-white/30">·</span>
            <span>MST: <span className="apg-mono tabular-nums">4600111735</span></span>
            <span className="text-white/30">·</span>
            <span>tanphuapg.com</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
