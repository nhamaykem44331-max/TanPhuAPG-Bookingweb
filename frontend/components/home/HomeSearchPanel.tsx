"use client";

import { type MouseEvent, useState } from 'react';
import type { AirportOption, AirportSelection, Cabin } from '@/lib/types';
import { filterAirports } from '@/lib/useAirports';

// Desktop: click vào <input type="date"> không tự mở lịch (chỉ icon lịch mới mở) → gọi
// showPicker() trong cùng cử chỉ. Thiết bị cảm ứng giữ hành vi chạm mặc định (mobile OK).
function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(pointer: fine)').matches) {
    return;
  }
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    input.showPicker?.();
  } catch {
    // lịch đã mở / trình duyệt không cho phép — bỏ qua.
  }
}

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
const CABIN_LABELS: Record<Cabin, string> = {
  economy: 'Phổ thông',
  premium: 'Phổ thông đặc biệt',
  business: 'Thương gia',
  first: 'Hạng nhất',
};
const CABIN_ORDER: Cabin[] = ['economy', 'premium', 'business', 'first'];

// navy header + green button + design palette (handoff "Tìm vé booktanphuapg")
const NAVY = 'linear-gradient(120deg,#0c2740 0%,#16456b 55%,#1a4e78 100%)';
const GREEN = 'linear-gradient(135deg,#1f5f44,#248a3d 55%,#3a9067)';

function fmtDateLabel(ymd: string) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]}, ${d} ${MONTHS[m - 1]}`;
}
function fmtDateNumeric(ymd: string) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
function airportCity(value: AirportSelection | null, airports: AirportOption[]) {
  if (!value?.code) return '';
  const airport = airports.find((item) => item.code === value.code);
  return airport?.city || value.label?.split('(')[0]?.trim() || value.code;
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}
function IconSwap() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
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
  loading,
  isReloading,
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
  showHero?: boolean;
  todayYmd: string;
  toSel: AirportSelection | null;
  tripType: 'oneway' | 'roundtrip';
}) {
  const busy = loading || isReloading;
  const total = adults + children + infants;
  const cityFrom = airportCity(fromSel, airports);
  const cityTo = airportCity(toSel, airports);
  const retValue = returnDate || defaultReturnDate;

  const [openPicker, setOpenPicker] = useState<null | 'from' | 'to' | 'cabin'>(null);
  const [query, setQuery] = useState('');

  const openAirport = (which: 'from' | 'to') => { setQuery(''); setOpenPicker(which); };
  const close = () => setOpenPicker(null);
  const pickAirport = (which: 'from' | 'to', sel: AirportSelection) => {
    if (which === 'from') onFromSelect(sel); else onToSelect(sel);
    close();
  };

  const airportRows = (which: 'from' | 'to') => {
    const list = filterAirports(airports, query, 40);
    if (list.length === 0) return <div className="apgx-aplist"><div className="empty">Không tìm thấy sân bay phù hợp.</div></div>;
    return (
      <div className="apgx-aplist">
        {list.map((airport) => (
          <button className="apgx-aprow" key={airport.code} type="button" onClick={() => pickAirport(which, { code: airport.code, label: airport.label })}>
            <span className="lead"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 16l9-3 9-3" /><path d="M11 13l-2-6 1.5-.5 4 5" /></svg></span>
            <span className="min-w-0">
              <span className="city block truncate">{airport.city} <span className="code">{airport.code}</span></span>
              <span className="name block truncate">{airport.name}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  // pax steppers (shared desktop grid + mobile rows)
  const pax = [
    { key: 'adults', t: 'Người lớn', s: '12 tuổi+', sMobile: '(12 tuổi trở lên)', value: adults, decDisabled: adults <= 1, incDisabled: total >= 9,
      onDec: () => onPassengerCountsChange({ adults: adults - 1, children, infants }), onInc: () => onPassengerCountsChange({ adults: adults + 1, children, infants }) },
    { key: 'children', t: 'Trẻ em', s: '2-11 tuổi', sMobile: '(2 đến dưới 12 tuổi)', value: children, decDisabled: children <= 0, incDisabled: total >= 9,
      onDec: () => onPassengerCountsChange({ adults, children: children - 1, infants }), onInc: () => onPassengerCountsChange({ adults, children: children + 1, infants }) },
    { key: 'infants', t: 'Em bé', s: 'Dưới 2 tuổi', sMobile: '(Dưới 2 tuổi)', value: infants, decDisabled: infants <= 0, incDisabled: infants >= adults || infants >= 4 || total >= 9,
      onDec: () => onPassengerCountsChange({ adults, children, infants: infants - 1 }), onInc: () => onPassengerCountsChange({ adults, children, infants: infants + 1 }) },
  ] as const;

  const stepper = (row: typeof pax[number]) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" aria-label={`Giảm ${row.t}`} disabled={row.decDisabled} onClick={row.onDec}
        style={{ border: 'none', background: 'transparent', color: row.decDisabled ? '#c4ccd4' : '#475569', fontSize: 20, lineHeight: 1, cursor: row.decDisabled ? 'default' : 'pointer', padding: '0 2px' }}>−</button>
      <span className="tnum" style={{ minWidth: 14, textAlign: 'center', fontSize: 16, fontWeight: 700, color: row.value ? '#16212b' : '#c4ccd4' }}>{row.value}</span>
      <button type="button" aria-label={`Tăng ${row.t}`} disabled={row.incDisabled} onClick={row.onInc}
        style={{ border: 'none', background: 'transparent', color: row.incDisabled ? '#c4ccd4' : '#475569', fontSize: 20, lineHeight: 1, cursor: row.incDisabled ? 'default' : 'pointer', padding: '0 2px' }}>+</button>
    </div>
  );

  const cabinMenu = (
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, background: '#fff', border: '1px solid #d4d8dd', borderRadius: 12, boxShadow: '0 14px 30px rgba(16,24,40,.18)', padding: 6, minWidth: 190 }} onClick={(e) => e.stopPropagation()}>
      {CABIN_ORDER.map((value) => (
        <button key={value} type="button" onClick={() => { onCabinChange(value); close(); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: cabin === value ? '#eef4fb' : 'transparent', color: '#16212b', borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: cabin === value ? 700 : 500, cursor: 'pointer' }}>
          {CABIN_LABELS[value]}
        </button>
      ))}
    </div>
  );

  const tripTabs = (mobile: boolean) => {
    const items: Array<['oneway' | 'roundtrip', string]> = [['oneway', 'Một chiều'], ['roundtrip', 'Khứ hồi']];
    if (mobile) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #475569', borderRadius: 12, padding: 3, marginBottom: 14 }}>
          {items.map(([type, label]) => {
            const on = tripType === type;
            return (
              <button key={type} type="button" onClick={() => onTripTypeChange(type)}
                style={{ height: 36, borderRadius: 9, border: 'none', background: on ? '#475569' : 'transparent', color: on ? '#fff' : '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
            );
          })}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 16, marginBottom: 18 }}>
        {items.map(([type, label]) => {
          const on = tripType === type;
          return (
            <button key={type} type="button" onClick={() => onTripTypeChange(type)}
              style={{ height: 40, padding: '0 20px', borderRadius: 8, border: on ? 'none' : '1px solid #d4d8dd', background: on ? '#475569' : '#fff', color: on ? '#fff' : '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
          );
        })}
      </div>
    );
  };

  const fieldBox: React.CSSProperties = { height: 50, border: '1px solid #d4d8dd', borderRadius: 10, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' };
  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 };

  const searchBtn = (mobile: boolean) => (
    <button type="button" disabled={busy} onClick={onSearch}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 'none', borderRadius: mobile ? 14 : 12, color: '#fff', fontSize: mobile ? 16 : 15, fontWeight: 800, cursor: busy ? 'default' : 'pointer', boxShadow: '0 8px 20px rgba(31,95,68,.3)', background: GREEN, opacity: busy ? 0.75 : 1, ...(mobile ? { height: 48, width: '100%' } : { minWidth: 280, padding: '14px 28px' }) }}>
      {busy ? 'Đang tìm…' : (<><IconSearch /> Tìm chuyến bay</>)}
    </button>
  );

  const note = <div style={{ marginTop: 12, fontSize: 12, color: '#7a8893' }}>Tối đa 9 hành khách mỗi lần tìm (NL + TE + EB), và EB không được vượt quá NL.</div>;
  const errorBanner = error ? <div className="apgx-banner error" style={{ marginTop: 12 }}><span>⚠</span><span>{error}</span></div> : null;

  return (
    <div className="apgx" style={{ background: '#eceef1' }}>
      <div className="mx-auto w-full max-w-[1320px] px-4 py-3.5 lg:px-7">

        {/* ===================== DESKTOP ===================== */}
        <div className="hidden lg:block" style={{ borderRadius: 18, overflow: 'visible', background: '#fff', boxShadow: '0 1px 3px rgba(16,24,40,.08)', position: 'relative' }}>
          {/* section header (brand removed — provided by SiteGlobeHeader above) */}
          <div style={{ background: NAVY, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,.85)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>Tìm chuyến bay</span>
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '7px 13px', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', color: 'rgba(255,255,255,.6)' }}>BOOKING DESK</div>
              <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 2 }}>{(fromSel?.code || '—')} → {(toSel?.code || '—')}</div>
            </div>
          </div>

          {/* white search panel */}
          <div style={{ padding: '18px 24px 22px' }}>
            {tripTabs(false)}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 48px minmax(0,1fr)', gap: 14, alignItems: 'end', marginBottom: 14 }}>
              <div style={{ position: 'relative' }}>
                <label style={fieldLabel}>Từ</label>
                <button type="button" style={{ ...fieldBox, fontSize: 15, color: cityFrom ? '#16212b' : '#9aa4ae' }} onClick={() => openAirport('from')}>
                  <span>{cityFrom ? `${cityFrom}${fromSel?.code ? ` (${fromSel.code})` : ''}` : 'Chọn điểm đi'}</span>
                </button>
                {openPicker === 'from' && (
                  <>
                    <div className="apgx-pop-backdrop" onClick={close} />
                    <div className="apgx-popover" style={{ width: 340 }} onClick={(e) => e.stopPropagation()}>
                      <div className="apgx-pphead">Chọn điểm đi</div>
                      <div className="apgx-ppbody">
                        <input className="apgx-input" placeholder="Tìm thành phố, sân bay hoặc mã" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                        {airportRows('from')}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button type="button" aria-label="Đảo chiều" onClick={onSwapRoute}
                style={{ height: 44, width: 44, border: '1px solid #d4d8dd', borderRadius: 10, background: '#fff', color: '#475569', cursor: 'pointer', display: 'grid', placeItems: 'center', marginBottom: 3 }}><IconSwap /></button>
              <div style={{ position: 'relative' }}>
                <label style={fieldLabel}>Đến</label>
                <button type="button" style={{ ...fieldBox, fontSize: 15, color: cityTo ? '#16212b' : '#9aa4ae' }} onClick={() => openAirport('to')}>
                  <span>{cityTo ? `${cityTo}${toSel?.code ? ` (${toSel.code})` : ''}` : 'Chọn điểm đến'}</span>
                </button>
                {openPicker === 'to' && (
                  <>
                    <div className="apgx-pop-backdrop" onClick={close} />
                    <div className="apgx-popover right" style={{ width: 340 }} onClick={(e) => e.stopPropagation()}>
                      <div className="apgx-pphead">Chọn điểm đến</div>
                      <div className="apgx-ppbody">
                        <input className="apgx-input" placeholder="Tìm thành phố, sân bay hoặc mã" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                        {airportRows('to')}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: tripType === 'roundtrip' ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={fieldLabel}>Ngày đi</label>
                <label style={{ ...fieldBox, position: 'relative', cursor: 'pointer' }}>
                  <span className="tnum" style={{ fontSize: 15, color: '#16212b' }}>{fmtDateNumeric(date) || 'Chọn ngày'}</span><IconCal />
                  <input type="date" aria-label="Ngày đi" value={date} min={todayYmd} onChange={(e) => onDateChange(e.target.value)} onClick={openDatePicker}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </label>
              </div>
              {tripType === 'roundtrip' && (
                <div>
                  <label style={fieldLabel}>Ngày về</label>
                  <label style={{ ...fieldBox, position: 'relative', cursor: 'pointer' }}>
                    <span className="tnum" style={{ fontSize: 15, color: '#16212b' }}>{fmtDateNumeric(retValue) || 'Chọn ngày'}</span><IconCal />
                    <input type="date" aria-label="Ngày về" value={retValue} min={minReturnDate} onChange={(e) => onReturnDateChange(e.target.value)} onClick={openDatePicker}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                  </label>
                </div>
              )}
            </div>

            {/* passengers + cabin */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', border: '1px solid #d4d8dd', borderRadius: 10, overflow: 'hidden' }}>
              {pax.map((row, i) => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRight: '1px solid #e5e7eb' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{i === 0 ? '👤 ' : ''}{row.t}</div><div style={{ fontSize: 11, color: '#9aa4ae' }}>{row.s}</div></div>
                  {stepper(row)}
                </div>
              ))}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Hạng vé</div><div style={{ fontSize: 11, color: '#9aa4ae' }}>Cabin class</div></div>
                <button type="button" onClick={() => setOpenPicker(openPicker === 'cabin' ? null : 'cabin')}
                  style={{ border: '1px solid #d4d8dd', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#16212b', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>{CABIN_LABELS[cabin]} ▾</button>
                {openPicker === 'cabin' && (<><div className="apgx-pop-backdrop" onClick={close} />{cabinMenu}</>)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginTop: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {quickRoutes.map(({ from, to }) => (
                  <button key={`${from.code}-${to.code}`} type="button" onClick={() => onQuickRouteSelect(from, to)}
                    style={{ border: '1px solid #d4d8dd', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#475569', background: '#fff', cursor: 'pointer' }}>{from.code}-{to.code}</button>
                ))}
              </div>
              {searchBtn(false)}
            </div>
            {note}
            {errorBanner}
          </div>
        </div>

        {/* ===================== MOBILE ===================== */}
        <div className="lg:hidden" style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(16,24,40,.08)', position: 'relative' }}>
          <div style={{ background: NAVY, padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.85)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Tìm chuyến bay</span>
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.08)', borderRadius: 9, padding: '5px 10px', textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,.55)' }}>DESK</div><div className="tnum" style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{(fromSel?.code || '—')}→{(toSel?.code || '—')}</div></div>
          </div>

          <div style={{ padding: '14px 14px 16px' }}>
            {tripTabs(true)}

            <div style={{ position: 'relative', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => openAirport('from')} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 10, padding: '12px 2px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <span style={{ paddingTop: 17, color: '#9aa4ae' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg></span>
                <span><span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569' }}>Khởi hành</span><span style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}><span className="tnum" style={{ borderRadius: 8, background: '#9aa4ae', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 7px' }}>{fromSel?.code || '—'}</span><span style={{ fontSize: 16, fontWeight: 800, color: '#143a5c' }}>{cityFrom || 'Chọn điểm đi'}</span></span></span>
              </button>
              <button type="button" aria-label="Đảo chiều" onClick={onSwapRoute} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 42, height: 42, borderRadius: '50%', border: '1px solid #d4d8dd', background: '#fff', color: '#143a5c', boxShadow: '0 8px 20px rgba(15,47,75,.12)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconSwap /></button>
              <button type="button" onClick={() => openAirport('to')} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 10, padding: '12px 2px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span style={{ paddingTop: 17, color: '#9aa4ae' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg></span>
                <span><span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569' }}>Điểm đến</span><span style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}><span className="tnum" style={{ borderRadius: 8, background: '#9aa4ae', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 7px' }}>{toSel?.code || '—'}</span><span style={{ fontSize: 16, fontWeight: 800, color: '#143a5c' }}>{cityTo || 'Chọn điểm đến'}</span></span></span>
              </button>
            </div>

            <label style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', alignItems: 'center', gap: 10, padding: '12px 2px', borderBottom: '1px solid #e5e7eb', position: 'relative', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa4ae" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569' }}>Ngày khởi hành{tripType === 'roundtrip' ? ' / ngày về' : ''}</span><span style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}><span className="tnum" style={{ fontSize: 15, fontWeight: 800, color: '#143a5c' }}>{fmtDateNumeric(date) || 'Chọn ngày'}</span>{tripType === 'roundtrip' && (<><span style={{ color: '#9aa4ae' }}>-</span><span className="tnum" style={{ fontSize: 15, fontWeight: 800, color: '#143a5c' }}>{fmtDateNumeric(retValue) || 'Chọn ngày'}</span></>)}</span></span>
              <input type="date" aria-label="Ngày đi" value={date} min={todayYmd} onChange={(e) => onDateChange(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </label>

            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}>
              {pax.map((row, i) => (
                <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
                  {i === 0 ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa4ae" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></svg>
                  ) : <span />}
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{row.t} <span style={{ fontWeight: 400, color: '#9aa4ae' }}>{row.sMobile}</span></div>
                  {stepper(row)}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', alignItems: 'center', gap: 10, padding: '12px 2px', position: 'relative' }}>
              <span />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Hạng vé</span>
              <button type="button" onClick={() => setOpenPicker(openPicker === 'cabin' ? null : 'cabin')} style={{ height: 38, display: 'inline-flex', alignItems: 'center', border: '1px solid #d4d8dd', borderRadius: 10, padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#143a5c', background: '#fff', cursor: 'pointer' }}>{CABIN_LABELS[cabin]} ▾</button>
              {openPicker === 'cabin' && (<><div className="apgx-pop-backdrop" onClick={close} />{cabinMenu}</>)}
            </div>

            {searchBtn(true)}
            {note}
            {errorBanner}
          </div>
        </div>

        {/* quick chips (mobile, below card) */}
        <div className="flex lg:hidden" style={{ gap: 8, overflowX: 'auto', padding: '12px 2px 2px', scrollbarWidth: 'none' }}>
          {quickRoutes.map(({ from, to }) => (
            <button key={`m-${from.code}-${to.code}`} type="button" onClick={() => onQuickRouteSelect(from, to)}
              style={{ flexShrink: 0, border: '1px solid #d4d8dd', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#475569', background: '#fff', cursor: 'pointer' }}>{from.code}-{to.code}</button>
          ))}
        </div>
      </div>

      {/* ===== MOBILE: Airport bottom-sheet (chỉ render trên mobile — desktop dùng dropdown inline) ===== */}
      {isDesktopViewport === false && (
        <>
          <div className={`apgx-sheet-backdrop lg:hidden${openPicker === 'from' || openPicker === 'to' ? ' open' : ''}`} onClick={close} />
          <div className={`apgx-sheet lg:hidden${openPicker === 'from' || openPicker === 'to' ? ' open' : ''}`} aria-hidden={!(openPicker === 'from' || openPicker === 'to')}>
            <div className="handle" />
            <div className="shead"><span className="t">{openPicker === 'to' ? 'Chọn điểm đến' : 'Chọn điểm đi'}</span><button className="x" type="button" onClick={close}>✕</button></div>
            <div className="sbody">
              <input className="apgx-input mb-2" placeholder="Tìm thành phố, sân bay hoặc mã" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div>{(openPicker === 'from' || openPicker === 'to') && airportRows(openPicker)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
