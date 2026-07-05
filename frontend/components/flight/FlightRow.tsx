"use client";

import AirlineLogo from '@/components/flight/AirlineLogo';
import FlightBadgePills from '@/components/flight/FlightBadgePills';
import { buildFlightConditionBadges } from '@/lib/flight-badges';
import type { FlightResult } from '@/lib/types';
import { durationText, fmtVND, hhmm } from '@/lib/utils';

export type AirportLabelMap = Record<string, { city: string; name: string }>;

function airportLabel(labels: AirportLabelMap | undefined, code: string, fallbackName: string) {
  const found = labels?.[code];
  if (found) return found;
  return { city: fallbackName || code, name: fallbackName || code };
}

export default function FlightRow({
  f,
  selected,
  onSelect,
  onDeselect,
  dense = false,
  dailyMinPrice,
  airportLabels,
  showRouteColumn = true,
  btnColor = 'gold',
}: {
  f: FlightResult;
  selected: boolean;
  onSelect: () => void;
  onDeselect?: () => void;
  btnColor?: 'gold' | 'blue';
  dense?: boolean;
  dailyMinPrice?: number | null;
  airportLabels?: AirportLabelMap;
  showRouteColumn?: boolean;
}) {
  const depApt = airportLabel(airportLabels, f.departure.airport, f.departure.airportName);
  const arrApt = airportLabel(airportLabels, f.arrival.airport, f.arrival.airportName);
  const btnClass = btnColor === 'blue'
    ? 'bg-[var(--apg-aviation-navy)] hover:bg-[var(--apg-aviation-navy-hover)] shadow-[0_1px_2px_rgba(10,79,134,0.30)]'
    : 'bg-[#ee8b1e] hover:bg-[#d9760f] shadow-[0_1px_2px_rgba(217,118,15,0.30)]';
  const conditionBadges = buildFlightConditionBadges(f, dailyMinPrice);
  const price = Number(f.fareBreakdown?.totalAmount ?? f.price.amount);
  const basePrice = Number(f.fareBreakdown?.baseAmount ?? f.price.amount);
  const serifNum = { fontFamily: "'Times New Roman', Times, serif" };

  const PriceBlock = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div className="text-right">
      <div className="flex items-baseline justify-end gap-0.5">
        <span className={`apg-mono font-bold tabular-nums tracking-tight text-[#1a1a1a] ${size === 'md' ? 'text-[15px] lg:text-[16px]' : 'text-[11px]'}`}>
          {price.toLocaleString('vi-VN')}
        </span>
        <span className={`font-medium text-slate-400 ${size === 'md' ? 'text-[11px]' : 'text-[9px]'}`}>₫</span>
      </div>
      {size === 'md' && <div className="mt-0.5 text-[10px] font-medium text-slate-400">≈ ${f.priceUSD}</div>}
    </div>
  );

  const SelectOrCheck = ({ compact = false }: { compact?: boolean }) =>
    selected ? (
      <div className="flex items-center gap-0.5">
        <div className={`rounded-md bg-green-600 font-bold text-white ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}`}>✓</div>
        {onDeselect && (
          <button
            className={`flex items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-transform active:scale-95 ${compact ? 'h-5 w-5 text-[8px]' : 'h-6 w-6 text-[9px]'}`}
            onClick={onDeselect}
            type="button"
          >
            ✕
          </button>
        )}
      </div>
    ) : (
      <button
        className={`rounded-[var(--apg-radius-sm)] font-bold text-white transition-all duration-150 active:scale-95 active:shadow-inner ${btnClass} ${compact ? 'min-w-[46px] px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
        onClick={onSelect}
        type="button"
      >
        Chọn
      </button>
    );

  return (
    <div className={`border-b border-[var(--apg-border-default)] px-2.5 py-2 transition-colors lg:px-4 lg:py-3 ${selected ? 'bg-[#fff7ed]' : 'hover:bg-[var(--apg-bg-surface-soft)]'}`}>
      {dense && (
        <div className="flex items-center gap-1.5">
          <AirlineLogo code={f.airlineCode} airline={f.airline} logo={f.airlineLogo} size={18} />
          <span className="shrink-0 text-[12px] font-bold leading-none text-[var(--apg-aviation-navy)]" style={serifNum}>{hhmm(f.departure.time)}</span>
          <span className="ml-auto text-[13px] font-bold leading-none text-[#1a1a1a]" style={serifNum}>{Math.round(basePrice / 1000).toLocaleString('vi-VN')}</span>
          <SelectOrCheck compact />
        </div>
      )}

      {!dense && (
        <>
          <div className="flex items-center gap-2 lg:hidden">
            <AirlineLogo code={f.airlineCode} airline={f.airline} logo={f.airlineLogo} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="text-sm font-bold text-[var(--apg-aviation-navy)]">{hhmm(f.departure.time)}</span>
                <span className="text-[10px] text-[var(--apg-brand-gold)]">→</span>
                <span className="text-sm font-bold text-[var(--apg-aviation-navy)]">{hhmm(f.arrival.time)}</span>
                <span className="text-[10px] text-slate-400">{durationText(f.duration)}</span>
              </div>
              <div className="truncate text-[10px] text-slate-400">{f.stops === 0 ? 'Bay thẳng' : `${f.stops} điểm dừng`}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PriceBlock />
              <SelectOrCheck />
            </div>
          </div>

          <div className={`hidden lg:grid lg:items-center lg:gap-4 ${
            showRouteColumn ? 'lg:grid-cols-[32px_auto_1fr_auto]' : 'lg:grid-cols-[32px_minmax(0,1fr)_auto]'
          }`}>
            <AirlineLogo code={f.airlineCode} airline={f.airline} logo={f.airlineLogo} size={28} />
            <div className={showRouteColumn ? 'w-[260px] shrink-0 pr-4' : 'min-w-0 pr-4'}>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-extrabold text-[var(--apg-aviation-navy)]">{hhmm(f.departure.time)}</span>
                <span className="text-sm text-[var(--apg-brand-gold)]">→</span>
                <span className="text-base font-extrabold text-[var(--apg-aviation-navy)]">{hhmm(f.arrival.time)}</span>
                <span className="text-[11px] text-slate-400">{durationText(f.duration)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="shrink-0">{f.stops === 0 ? 'Bay thẳng' : `${f.stops} điểm dừng`}</span>
                <span className="shrink-0">·</span>
                <span className="shrink-0 font-medium">{f.flightNumber}</span>
                <span className="shrink-0">·</span>
                <span className="truncate">{f.airline}</span>
              </div>
            </div>
            {showRouteColumn && (
            <div className="justify-self-center text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-[var(--apg-aviation-navy)]">{depApt.city} ({f.departure.airport})</span>
                <span className="shrink-0 text-[11px] text-[var(--apg-brand-gold)]">→</span>
                <span className="text-sm font-bold text-[var(--apg-aviation-navy)]">{arrApt.city} ({f.arrival.airport})</span>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <span>{depApt.name}</span>
                <span>→</span>
                <span>{arrApt.name}</span>
              </div>
            </div>
            )}
            <div className="flex items-center gap-2">
              <PriceBlock />
              <SelectOrCheck />
            </div>
          </div>
        </>
      )}

      {!dense && <FlightBadgePills badges={conditionBadges} className="mt-2" />}
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

export function FlightRowSkeleton({ dense = false }: { dense?: boolean }) {
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

export function RouteMismatchNotice({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50/70 px-3 text-amber-700 ${dense ? 'py-1.5 text-[10px]' : 'py-2 text-[11px]'}`}>
      <svg aria-hidden="true" fill="currentColor" height="11" viewBox="0 0 24 24" width="11">
        <path d="M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z" />
      </svg>
      <span>Đã đổi chặng - bấm "Tìm vé" để cập nhật</span>
    </div>
  );
}

export function LoadMoreRowsButton({
  remaining,
  step,
  onClick,
}: {
  remaining: number;
  step: number;
  onClick: () => void;
}) {
  if (remaining <= 0) return null;
  return (
    <div className="flex justify-center border-t border-[var(--apg-border-default)] bg-white px-3 py-3">
      <button
        className="apg-btn-secondary h-10 px-4 text-sm font-bold"
        onClick={onClick}
        type="button"
      >
        Tải thêm {Math.min(step, remaining)} chuyến
      </button>
    </div>
  );
}
