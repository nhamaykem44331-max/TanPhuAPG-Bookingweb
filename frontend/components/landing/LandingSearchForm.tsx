'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SEARCH_STATE_KEY } from '@/lib/homeSearchStore';
import type { Cabin } from '@/lib/types';

type Trip = 'roundtrip' | 'oneway';

const AIRPORTS: Array<{ code: string; city: string; intl: boolean }> = [
  { code: 'HAN', city: 'Hà Nội (Nội Bài)', intl: false },
  { code: 'SGN', city: 'TP. Hồ Chí Minh (Tân Sơn Nhất)', intl: false },
  { code: 'DAD', city: 'Đà Nẵng', intl: false },
  { code: 'CXR', city: 'Nha Trang (Cam Ranh)', intl: false },
  { code: 'PQC', city: 'Phú Quốc', intl: false },
  { code: 'HPH', city: 'Hải Phòng (Cát Bi)', intl: false },
  { code: 'HUI', city: 'Huế (Phú Bài)', intl: false },
  { code: 'VII', city: 'Vinh', intl: false },
  { code: 'DLI', city: 'Đà Lạt (Liên Khương)', intl: false },
  { code: 'VCA', city: 'Cần Thơ', intl: false },
  { code: 'UIH', city: 'Quy Nhơn (Phù Cát)', intl: false },
  { code: 'VDO', city: 'Vân Đồn (Quảng Ninh)', intl: false },
  { code: 'ICN', city: 'Seoul (Incheon)', intl: true },
  { code: 'BKK', city: 'Bangkok (Suvarnabhumi)', intl: true },
  { code: 'SIN', city: 'Singapore (Changi)', intl: true },
  { code: 'NRT', city: 'Tokyo (Narita)', intl: true },
  { code: 'TPE', city: 'Đài Bắc (Đào Viên)', intl: true },
];

const CABINS: Array<{ label: string; value: Cabin }> = [
  { label: 'Phổ thông', value: 'economy' },
  { label: 'Phổ thông đặc biệt', value: 'premium' },
  { label: 'Thương gia', value: 'business' },
];

const QUICK_CHIPS = ['HAN-SGN', 'HAN-DAD', 'SGN-HAN', 'HAN-PQC', 'SGN-DAD', 'HAN-CXR', 'SGN-PQC'];
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(base: Date, days: number) { const d = new Date(base); d.setDate(d.getDate() + days); return d; }
function cityOf(code: string) { return AIRPORTS.find((a) => a.code === code)?.city || code; }
function labelOf(code: string) { return `${cityOf(code)} (${code})`; }
function fmtVN(s: string) {
  if (!s) return '';
  const [y, m, dd] = s.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  return `${DOW[d.getDay()]}, ${pad2(dd)}/${pad2(m)}/${y}`;
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  opacity: 0, cursor: 'pointer', border: 0, padding: 0, margin: 0,
};

// Desktop: click vào ô <input type="date"> KHÔNG tự mở lịch (chỉ icon lịch mới mở),
// nên phải gọi showPicker() trong cùng cử chỉ click. Trên thiết bị cảm ứng (pointer thô)
// giữ nguyên hành vi chạm mặc định để không đổi trải nghiệm mobile đang chạy tốt.
function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(pointer: fine)').matches) {
    return;
  }
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    input.showPicker?.();
  } catch {
    // showPicker có thể ném lỗi nếu lịch đã mở / trình duyệt không cho phép — bỏ qua.
  }
}

export default function LandingSearchForm() {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip>('roundtrip');
  const [from, setFrom] = useState('HAN');
  const [to, setTo] = useState('SGN');
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [adt, setAdt] = useState(1);
  const [chd, setChd] = useState(0);
  const [inf, setInf] = useState(0);
  const [cabin, setCabin] = useState<Cabin>('economy');
  const [paxOpen, setPaxOpen] = useState(false);
  const [swap, setSwap] = useState(false);
  const paxBoxRef = useRef<HTMLDivElement>(null);

  // Khởi tạo ngày sau khi mount để tránh lệch SSR/hydration theo timezone.
  useEffect(() => {
    const today = new Date();
    setDepart(ymd(addDays(today, 3)));
    setRet(ymd(addDays(today, 5)));
  }, []);

  // Đóng panel hành khách khi bấm ra ngoài.
  useEffect(() => {
    if (!paxOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (paxBoxRef.current && !paxBoxRef.current.contains(e.target as Node)) setPaxOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [paxOpen]);

  const total = adt + chd + inf;
  const todayStr = ymd(new Date());
  const minReturn = depart || todayStr;
  if (ret && ret < minReturn) setRet(minReturn);

  function changeFrom(code: string) {
    if (code === to) setTo(from);
    setFrom(code);
  }
  function changeTo(code: string) {
    if (code === from) setFrom(to);
    setTo(code);
  }
  function doSwap() {
    setFrom(to); setTo(from);
    setSwap(true); setTimeout(() => setSwap(false), 360);
  }
  function pickChip(chip: string) {
    const [a, b] = chip.split('-');
    if (a && b) { setFrom(a); setTo(b); }
  }
  function incAdt() { if (total < 9) setAdt(adt + 1); }
  function decAdt() { if (adt > 1) { const na = adt - 1; setAdt(na); if (inf > na) setInf(na); } }
  function incChd() { if (total < 9) setChd(chd + 1); }
  function decChd() { if (chd > 0) setChd(chd - 1); }
  function incInf() { if (total < 9 && inf < adt) setInf(inf + 1); }
  function decInf() { if (inf > 0) setInf(inf - 1); }

  const paxText = (() => {
    const parts = [`${adt} người lớn`];
    if (chd) parts.push(`${chd} trẻ em`);
    if (inf) parts.push(`${inf} em bé`);
    const cabinLabel = CABINS.find((c) => c.value === cabin)?.label || 'Phổ thông';
    return `${parts.join(', ')} · ${cabinLabel}`;
  })();

  function onSubmit() {
    if (!from || !to || from === to || !depart) return;
    const payload = {
      fromSel: { code: from, label: labelOf(from) },
      toSel: { code: to, label: labelOf(to) },
      from, to,
      date: depart,
      returnDate: trip === 'roundtrip' ? (ret || ymd(addDays(new Date(depart), 2))) : '',
      tripType: trip,
      adults: adt, children: chd, infants: inf,
      cabin,
      roundtripViewMode: 'legs',
      pairSourceFilter: 'all',
      sortOneway: 'price', sortDepart: 'price', sortReturn: 'price',
    };
    try { localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(payload)); } catch { /* noop */ }
    router.push('/dat-ve?go=1');
  }

  return (
    <div className="searchwrap">
      <div className="container">
        <div className={trip === 'oneway' ? 'searchcard oneway' : 'searchcard'}>
          <div className="sc-tabs">
            <button className={trip === 'roundtrip' ? 'sc-tab active' : 'sc-tab'} onClick={() => setTrip('roundtrip')}>Khứ hồi</button>
            <button className={trip === 'oneway' ? 'sc-tab active' : 'sc-tab'} onClick={() => setTrip('oneway')}>Một chiều</button>
          </div>

          <div className="route-box">
            <div className="route-field from" style={{ position: 'relative' }}>
              <span className="rf-ic from"><svg className="ic"><use href="#i-plane" /></svg></span>
              <span className="rf-text"><span className="f-label">Từ</span><span className="f-value"><span className="code">{from}</span> {cityOf(from)}</span></span>
              <select aria-label="Điểm đi" value={from} onChange={(e) => changeFrom(e.target.value)} style={overlay}>
                <optgroup label="Trong nước">{AIRPORTS.filter((a) => !a.intl).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</optgroup>
                <optgroup label="Quốc tế">{AIRPORTS.filter((a) => a.intl).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</optgroup>
              </select>
            </div>
            <button className={swap ? 'route-swap spin' : 'route-swap'} onClick={doSwap} aria-label="Đổi chiều"><svg className="ic"><use href="#i-swap" /></svg></button>
            <div className="route-field to" style={{ position: 'relative' }}>
              <span className="rf-ic to"><svg className="ic"><use href="#i-plane" /></svg></span>
              <span className="rf-text"><span className="f-label">Đến</span><span className="f-value"><span className="code">{to}</span> {cityOf(to)}</span></span>
              <select aria-label="Điểm đến" value={to} onChange={(e) => changeTo(e.target.value)} style={overlay}>
                <optgroup label="Trong nước">{AIRPORTS.filter((a) => !a.intl).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</optgroup>
                <optgroup label="Quốc tế">{AIRPORTS.filter((a) => a.intl).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</optgroup>
              </select>
            </div>
          </div>

          <div className="sc-dates">
            <label className="cell depart" style={{ position: 'relative' }}>
              <span className="f-label">Ngày đi</span>
              <span className="f-value" suppressHydrationWarning><svg className="ic"><use href="#i-cal" /></svg> {fmtVN(depart) || 'Chọn ngày'}</span>
              <input type="date" value={depart} min={todayStr} onChange={(e) => setDepart(e.target.value)} onClick={openDatePicker} style={overlay} aria-label="Ngày đi" />
            </label>
            <label className="cell return" style={{ position: 'relative' }}>
              <span className="f-label">Ngày về</span>
              <span className="f-value" suppressHydrationWarning><svg className="ic"><use href="#i-cal" /></svg> {fmtVN(ret) || 'Chọn ngày'}</span>
              <input type="date" value={ret} min={minReturn} onChange={(e) => setRet(e.target.value)} onClick={openDatePicker} style={overlay} aria-label="Ngày về" />
            </label>
            <div className="pax-box" ref={paxBoxRef}>
              <button className="pax-summary" aria-expanded={paxOpen} onClick={() => setPaxOpen((v) => !v)}>
                <span className="rf-text"><span className="f-label">Hành khách &amp; hạng vé</span><span className="f-value">{paxText}</span></span>
                <svg className="ic pax-chev"><use href="#i-chev" /></svg>
              </button>
              <div className="pax-panel" hidden={!paxOpen}>
                <div className="pax-row"><div><div className="pr-t">Người lớn</div><div className="pr-s">12 tuổi trở lên</div></div><div className="stepper"><button className="step-btn" onClick={decAdt} disabled={adt <= 1} aria-label="Giảm">−</button><span className="step-val">{adt}</span><button className="step-btn" onClick={incAdt} disabled={total >= 9} aria-label="Tăng">+</button></div></div>
                <div className="pax-row"><div><div className="pr-t">Trẻ em</div><div className="pr-s">2 – 11 tuổi</div></div><div className="stepper"><button className="step-btn" onClick={decChd} disabled={chd <= 0} aria-label="Giảm">−</button><span className="step-val">{chd}</span><button className="step-btn" onClick={incChd} disabled={total >= 9} aria-label="Tăng">+</button></div></div>
                <div className="pax-row"><div><div className="pr-t">Em bé</div><div className="pr-s">Dưới 2 tuổi</div></div><div className="stepper"><button className="step-btn" onClick={decInf} disabled={inf <= 0} aria-label="Giảm">−</button><span className="step-val">{inf}</span><button className="step-btn" onClick={incInf} disabled={total >= 9 || inf >= adt} aria-label="Tăng">+</button></div></div>
                <div className="pax-row cabin-row"><div className="pr-t">Hạng vé</div><div className="cabin-opts">{CABINS.map((c) => <button key={c.value} className={cabin === c.value ? 'cabin-opt active' : 'cabin-opt'} onClick={() => setCabin(c.value)}>{c.label}</button>)}</div></div>
                <button className="pax-done" onClick={() => setPaxOpen(false)}>Xong</button>
              </div>
            </div>
          </div>

          <button className="btn btn-green btn-search" onClick={onSubmit}><svg className="ic"><use href="#i-search" /></svg> Tìm chuyến bay</button>

          <div className="sc-note"><svg className="ic"><use href="#i-shield" /></svg><span>Tối đa 9 hành khách mỗi lần tìm (<b>NL + TE + EB</b>), và EB không được vượt quá NL.</span></div>

          <div className="chips-scroll">
            <div className="chips">
              {QUICK_CHIPS.map((c) => <button key={c} className="chip" onClick={() => pickChip(c)}>{c}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
