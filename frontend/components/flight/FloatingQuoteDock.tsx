"use client";

import type { Ref } from 'react';
import AirlineLogo, { airlineColor } from '@/components/flight/AirlineLogo';
import FlightBadgePills from '@/components/flight/FlightBadgePills';
import { buildFlightBadges } from '@/lib/flight-badges';
import type { FlightResult } from '@/lib/types';
import { fmtVND, hhmm } from '@/lib/utils';

function buildPassengerSummary(adults: number, children: number, infants: number) {
  const parts = [`${adults} người lớn`];
  if (children > 0) parts.push(`${children} trẻ em`);
  if (infants > 0) parts.push(`${infants} em bé`);
  return parts.join(' · ');
}

export default function FloatingQuoteDock({
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
  // total = giá 1 người lớn. Chỉ cộng phần người lớn (chính xác); giá trẻ em/em bé
  // KHÔNG có ở bước tìm (chỉ có khi giữ chỗ) → không bịa, chỉ ghi rõ để tránh sốc giá.
  const hasExtraPax = children > 0 || infants > 0;
  const totalLabel = `${hasExtraPax ? 'từ ' : ''}${fmtVND(total * adults)}`;
  const totalNote = hasExtraPax
    ? `Giá ${adults} người lớn · trẻ em/em bé tính khi giữ chỗ`
    : 'Đã gồm giá các chuyến đã chọn';

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

  const MiniLeg = ({ label, flight }: { label: string; flight: FlightResult }) => {
    const amount = flight.fareBreakdown?.totalAmount ?? flight.price.amount;
    return (
      <div className="min-w-0 rounded-xl bg-white/10 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{label}</span>
          <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={16} />
          <span className="truncate text-[10.5px] font-medium text-white/85">{flight.airline}</span>
        </div>
        <div className="mt-1 apg-mono text-[13px] font-bold leading-tight text-white">{hhmm(flight.departure.time)} → {hhmm(flight.arrival.time)}</div>
        <div className="apg-tabular text-[10.5px] text-white/70">{fmtVND(amount)}</div>
      </div>
    );
  };

  return (
    <div
      data-quote-dock=""
      className="pointer-events-none fixed left-0 z-40 w-full px-0 transition-[bottom,opacity,transform] duration-300"
      style={{ bottom }}
    >
      <div className="pointer-events-auto mx-auto max-w-[1440px] px-3 lg:px-6 xl:px-8" ref={dockRef}>
        <div className="overflow-hidden rounded-[24px] border border-[var(--apg-border-default)] bg-white/88 shadow-[0_20px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="text-white lg:hidden" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy))' }}>
            <div className="flex items-center justify-between gap-2 px-3.5 pb-1.5 pt-3">
              <div className="apg-display text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Đã chọn chuyến</div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="rounded-full border border-white/25 px-2.5 py-0.5 text-[10px] font-semibold text-white/85">
                  {tripType === 'oneway' ? 'Một chiều' : 'Khứ hồi'}
                </div>
                <button
                  aria-label="Bỏ chọn chuyến bay"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                  onClick={onClear}
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className={`grid gap-2 px-3.5 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {tripType === 'oneway' && onewayFlight ? <MiniLeg label="Một chiều" flight={onewayFlight} /> : null}
              {tripType === 'roundtrip' && outboundFlight ? <MiniLeg label="Đi" flight={outboundFlight} /> : null}
              {tripType === 'roundtrip' && inboundFlight ? <MiniLeg label="Về" flight={inboundFlight} /> : null}
            </div>

            <div className="px-3.5 pb-3.5 pt-2.5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="apg-display text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Tổng đã gồm thuế phí</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/60">{hasExtraPax ? totalNote : passengerSummary}</div>
                </div>
                <div className="apg-tabular shrink-0 text-[25px] font-black leading-none text-white">{totalLabel}</div>
              </div>
              <button
                className="mt-2.5 h-11 w-full rounded-[14px] bg-[#ee8b1e] text-sm font-bold text-white shadow-[0_8px_18px_rgba(217,118,15,0.35)] transition hover:bg-[#d9760f] active:scale-95"
                onClick={onContinue}
                type="button"
              >
                Tiếp tục đặt vé →
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
              className="w-[308px] shrink-0 rounded-[20px] px-4 py-3 text-white shadow-[0_14px_28px_rgba(0,0,0,0.22)]"
              style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy))' }}
            >
              <div className="apg-eyebrow text-white/65">Tổng đã gồm thuế phí</div>
              <div className="apg-tabular mt-1.5 text-[32px] font-black leading-none text-white">{totalLabel}</div>
              <div className="mt-1.5 text-[13px] text-white/80">{passengerSummary}</div>
              <div className="mt-0.5 text-[11px] text-white/60">{totalNote}</div>
              <button
                className="mt-3 h-10 w-full rounded-[14px] bg-[#ee8b1e] text-sm font-bold text-white shadow-[0_8px_18px_rgba(217,118,15,0.35)] transition hover:bg-[#d9760f]"
                onClick={onContinue}
                type="button"
              >
                Tiếp tục đặt vé →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
