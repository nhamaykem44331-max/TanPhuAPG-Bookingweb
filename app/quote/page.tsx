"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Download, Eye, EyeOff, Globe, Mail, Phone } from 'lucide-react';
import type { FlightResult, QuotePayload } from '@/lib/types';
import { durationText, fmtVND, hhmm } from '@/lib/utils';
import { getAirlineMeta } from '@/lib/airlines';
import { prefetchAncillaryResponse } from '@/lib/ancillary-cache';
import { findAirportByCode, useAirports } from '@/lib/useAirports';
import HoldBookingModal from '@/components/HoldBookingModal';

function longDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''));
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function cabinLabel(c: string) {
  return {
    economy: 'Phổ thông',
    premium: 'Phổ thông đặc biệt',
    business: 'Thương gia',
    first: 'Hạng nhất',
  }[c] ?? c;
}

type AirportList = ReturnType<typeof useAirports>['airports'];

function airportCodeLabel(airports: AirportList, code?: string) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return '';
  const meta = findAirportByCode(airports, normalized);
  return meta ? `${meta.city} (${meta.code})` : normalized;
}

function airportEndpointLabel(airports: AirportList, endpoint: FlightResult['departure']) {
  const code = String(endpoint.airport || '').trim().toUpperCase();
  const meta = findAirportByCode(airports, code);
  if (meta) return `${meta.city} (${meta.code})`;

  const city = String(endpoint.city || '').trim();
  const name = String(endpoint.airportName || '').trim();
  if (code && city && city.toUpperCase() !== code) return `${city} (${code})`;
  if (code && name && name.toUpperCase() !== code) return `${name} (${code})`;
  return code || city || name;
}

function routeAirportLabel(airports: AirportList, from: FlightResult['departure'], to: FlightResult['arrival']) {
  return `${airportEndpointLabel(airports, from)} → ${airportEndpointLabel(airports, to)}`;
}

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

function parseHmToMinutes(hm?: string) {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesShort(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}`;
}

type ParsedSegment = {
  from: string;
  to: string;
  flightNumber: string;
  departHm: string;
  arriveHm: string;
  departDate: string;
  arriveDate: string;
  durationMinutes: number;
};

function parseJourneySegments(detailUrl?: string | null): ParsedSegment[] {
  if (!detailUrl) return [];
  try {
    const url = new URL(detailUrl);
    const raw = url.searchParams.get('segoutbound') || url.searchParams.get('seginbound') || '';
    if (!raw) return [];
    return raw
      .split('|')
      .map((segment) => {
        const parts = segment.split('-');
        if (parts.length < 16) return null;
        const durationRaw = (parts[15] || '').replace(/^dur/i, '');
        const durationMinutes = /^\d{4}$/.test(durationRaw)
          ? Number(durationRaw.slice(0, 2)) * 60 + Number(durationRaw.slice(2))
          : 0;
        return {
          from: parts[0],
          to: parts[1],
          flightNumber: parts[3],
          departHm: parts[4],
          arriveHm: parts[5],
          departDate: parts[10],
          arriveDate: parts[12],
          durationMinutes,
        };
      })
      .filter(Boolean) as ParsedSegment[];
  } catch {
    return [];
  }
}

function dateFromAbayText(s?: string) {
  if (!s || !/^\d{1,2}[A-Za-z]{3}\d{4}$/.test(s)) return null;
  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const day = Number(s.slice(0, s.length - 7));
  const month = s.slice(s.length - 7, s.length - 4);
  const year = Number(s.slice(-4));
  if (!(month in months)) return null;
  return new Date(year, months[month], day, 12, 0, 0, 0);
}

function longDateFromAbayText(s?: string) {
  const d = dateFromAbayText(s);
  if (!d) return '';
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildLayovers(detailUrl?: string | null) {
  const segments = parseJourneySegments(detailUrl);
  if (segments.length < 2) return [];

  const output: {
    airport: string;
    durationText: string;
    fromSegment: ParsedSegment;
    toSegment: ParsedSegment;
  }[] = [];

  for (let i = 0; i < segments.length - 1; i += 1) {
    const current = segments[i];
    const next = segments[i + 1];
    const arrivalMinutes = parseHmToMinutes(current.arriveHm);
    const departMinutes = parseHmToMinutes(next.departHm);
    if (arrivalMinutes == null || departMinutes == null) continue;

    let diff = departMinutes - arrivalMinutes;
    const currentDate = dateFromAbayText(current.arriveDate);
    const nextDate = dateFromAbayText(next.departDate);
    if (currentDate && nextDate) {
      diff += Math.round((nextDate.getTime() - currentDate.getTime()) / 60000);
    } else if (diff < 0) {
      diff += 24 * 60;
    }

    output.push({
      airport: next.from,
      durationText: formatMinutesShort(diff),
      fromSegment: current,
      toSegment: next,
    });
  }

  return output;
}

function AirlineLogo({
  code,
  airline,
  logo,
  size = 28,
}: {
  code?: string;
  airline?: string;
  logo?: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [code, airline, logo]);
  const meta = getAirlineMeta(code, airline, logo);
  const bg = airlineColor(code || '');

  if (meta.logo && !imgFailed) {
    return (
      <img
        src={meta.logo}
        alt={code || ''}
        width={size}
        height={size}
        className="shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-0.5"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg }}
      className="flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white"
    >
      {code?.slice(0, 2) || '✈'}
    </div>
  );
}

function FlightSegment({
  label,
  flight,
  date,
  color,
}: {
  label: string;
  flight: FlightResult;
  date?: string;
  color: string;
}) {
  const { airports } = useAirports();
  const layovers = buildLayovers(flight.detailUrl);
  const amount = flight.fareBreakdown?.totalAmount ?? flight.price.amount;

  const airportLabel = (iata: string) => airportCodeLabel(airports, iata);

  return (
    <div className="overflow-hidden rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white shadow-sm">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: `linear-gradient(135deg, var(--apg-aviation-navy), color-mix(in srgb, ${color} 55%, var(--apg-aviation-navy)))` }}
      >
        <span className="apg-display text-[11px] font-medium uppercase tracking-[0.22em] text-white/90">{label}</span>
        <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold text-white">
          {longDate(date)}
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-4">
        <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="apg-mono text-xl font-black text-[#1a1a1a]">{hhmm(flight.departure.time)}</span>
            <span className="text-sm text-[var(--apg-brand-gold)]">→</span>
            <span className="apg-mono text-xl font-black text-[#1a1a1a]">{hhmm(flight.arrival.time)}</span>
            <span className="text-xs text-slate-400">{durationText(flight.duration)}</span>
          </div>
          <div className="text-sm text-slate-500">
            {flight.airline} · {flight.flightNumber} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}
          </div>
          <div className="text-sm leading-snug text-slate-600">
            {routeAirportLabel(airports, flight.departure, flight.arrival)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="apg-tabular text-lg font-black text-[#1a1a1a]">{fmtVND(amount)}</div>
          <div className="text-[11px] text-slate-400">/người</div>
        </div>
      </div>

      {layovers.length > 0 && (
        <div className="border-t border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3">
          <div className="space-y-2">
            {layovers.map((stop, idx) => (
              <div key={`${stop.airport}-${idx}`} className="rounded-lg border border-[var(--apg-border-default)] bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="font-semibold text-[#1a1a1a]">
                    {airportLabel(stop.fromSegment.from)} → {airportLabel(stop.fromSegment.to)}
                  </div>
                  <div className="text-slate-500">{longDateFromAbayText(stop.fromSegment.departDate)}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={22} />
                  <div className="min-w-0 flex-1 text-xs text-slate-700">{stop.fromSegment.flightNumber}</div>
                  <div className="text-xs text-slate-500">{formatMinutesShort(stop.fromSegment.durationMinutes)}</div>
                  <div className="apg-mono text-sm font-bold text-[#1a1a1a]">
                    {stop.fromSegment.departHm} - {stop.fromSegment.arriveHm}
                  </div>
                </div>
                <div className="my-3 flex items-center gap-2 pl-2">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--apg-text-secondary)] bg-white">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--apg-text-secondary)]" />
                  </div>
                  <div className="h-8 w-px bg-[var(--apg-border-strong)]" />
                  <div className="text-sm font-semibold text-[var(--apg-text-secondary)]">Nối chuyến: {stop.durationText}</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="font-semibold text-[#1a1a1a]">
                    {airportLabel(stop.toSegment.from)} → {airportLabel(stop.toSegment.to)}
                  </div>
                  <div className="text-slate-500">{longDateFromAbayText(stop.toSegment.departDate)}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <AirlineLogo code={flight.airlineCode} airline={flight.airline} logo={flight.airlineLogo} size={22} />
                  <div className="min-w-0 flex-1 text-xs text-slate-700">{stop.toSegment.flightNumber}</div>
                  <div className="text-xs text-slate-500">{formatMinutesShort(stop.toSegment.durationMinutes)}</div>
                  <div className="apg-mono text-sm font-bold text-[#1a1a1a]">
                    {stop.toSegment.departHm} - {stop.toSegment.arriveHm}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const UNLOCK_PASSWORD = '8888';
const TICKET_NOTICE_INTRO =
  'Quý khách vui lòng có mặt ở sân bay trước giờ khởi hành 90 phút cho chuyến bay nội địa và 180 phút cho chuyến bay quốc tế.';
const TICKET_NOTICE_ITEMS = [
  'Quầy thủ tục sẽ đóng trước 60 phút so với giờ khởi hành chuyến bay.',
  'Giấy tờ tùy thân: CCCD, Hộ chiếu, bằng gốc và còn hạn sử dụng theo quy định của pháp luật.',
  'Đối với trẻ em dưới 14 tuổi phải có Giấy Khai Sinh bản gốc hoặc bản sao y trích lục.',
  'Trẻ em, phụ nữ mang thai, người lớn tuổi cần liên hệ với nhân viên phòng vé để được tư vấn thêm về thủ tục đi máy bay trước khi xuất vé.',
];
const TICKET_NOTICE_CONFIRM =
  'Quý khách vui lòng đọc kỹ mọi thông tin trên vé (Họ và tên, hành trình, ngày giờ bay), chúng tôi sẽ không chịu trách nhiệm về giấy tờ tùy thân hoặc sai sót thông tin sau khi Quý khách đã xác nhận xuất vé.';
const TICKET_NOTICE_THANKS = 'CẢM ƠN QUÝ KHÁCH, CHÚC QUÝ KHÁCH CÓ MỘT CHUYẾN BAY VUI VẺ';

type EditableTicket = {
  outPrice: number;
  inPrice: number;
  taxPct: number;
  phone: string;
  website: string;
  email: string;
  note: string;
};

function TicketModal({
  data,
  onClose,
  usdRate,
}: {
  data: QuotePayload;
  onClose: () => void;
  usdRate: number;
}) {
  const { airports } = useAirports();
  const [locked, setLocked] = useState(true);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [showTicketFare, setShowTicketFare] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'jpg' | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const isRT = data.tripType === 'roundtrip' && !!data.inbound;
  const outAmt = data.outbound.fareBreakdown?.totalAmount ?? data.outbound.price.amount;
  const inAmt = data.inbound?.fareBreakdown?.totalAmount ?? data.inbound?.price.amount ?? 0;
  const [ed, setEd] = useState<EditableTicket>({
    outPrice: outAmt,
    inPrice: inAmt,
    taxPct: 12,
    phone: '0918.752.686',
    website: 'tanphuapg.com',
    email: 'tkt.tanphu@gmail.com',
    note: 'Giá tham khảo. Liên hệ TAN PHU APG để xác nhận.',
  });

  const farePerPax = ed.outPrice + ed.inPrice;
  const totalAdults = farePerPax * data.adults;
  const tax = Math.round((totalAdults * ed.taxPct) / 100);
  const grandTotal = Math.round(totalAdults + tax);
  const formatTicketMoney = (value: number) => `${Number(value).toLocaleString('vi-VN')}đ`;

  const airportLabel = (iata: string) => airportCodeLabel(airports, iata);

  async function captureCanvas() {
    if (!printRef.current) return null;
    const h2c = (await import('html2canvas')).default;
    return h2c(printRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f5f0e8',
      logging: false,
    });
  }

  async function handlePDF() {
    setExporting('pdf');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const { jsPDF } = await import('jspdf');
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF({
        orientation: height > width ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [width, height],
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height);
      pdf.save('BaoGia-TanPhuAPG.pdf');
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(null);
    }
  }

  async function handleJPEG() {
    setExporting('jpg');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'BaoGia-TanPhuAPG.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 lg:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-end justify-center lg:items-center">
        <div className="my-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl lg:max-w-[1240px] xl:max-w-[1320px] lg:rounded-2xl">
          <div className="flex items-center justify-between border-b border-[var(--apg-border-default)] px-4 py-3 lg:px-5">
            <div className="apg-display">
              <div className="text-sm font-bold">Mặt vé báo giá</div>
              <div className="text-[10px] text-slate-400">Xem trước · Chỉnh sửa · Tải về</div>
            </div>
            <button
              onClick={onClose}
              className="apg-btn-secondary flex h-8 w-8 items-center justify-center px-0 text-slate-400 shadow-none"
            >
              ×
            </button>
          </div>

          {!locked && (
            <div className="border-b border-[#e8dcc8] bg-[var(--apg-bg-surface-soft)] px-4 py-2 lg:hidden">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500">Giá đi (VND)</label>
                  <input
                    type="number"
                    value={ed.outPrice}
                    onChange={(event) => setEd((prev) => ({ ...prev, outPrice: Number(event.target.value) }))}
                    className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                  />
                </div>
                {isRT && (
                  <div>
                    <label className="text-[10px] text-slate-500">Giá về (VND)</label>
                    <input
                      type="number"
                      value={ed.inPrice}
                      onChange={(event) => setEd((prev) => ({ ...prev, inPrice: Number(event.target.value) }))}
                      className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-slate-500">Thuế %</label>
                  <input
                    type="number"
                    value={ed.taxPct}
                    onChange={(event) => setEd((prev) => ({ ...prev, taxPct: Number(event.target.value) }))}
                    className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Điện thoại</label>
                  <input
                    value={ed.phone}
                    onChange={(event) => setEd((prev) => ({ ...prev, phone: event.target.value }))}
                    className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Trang web</label>
                  <input
                    value={ed.website}
                    onChange={(event) => setEd((prev) => ({ ...prev, website: event.target.value }))}
                    className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Email</label>
                  <input
                    value={ed.email}
                    onChange={(event) => setEd((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded border border-[var(--apg-border-strong)] px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

        <div className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-auto bg-[var(--apg-bg-page)] p-3 lg:p-6 xl:p-8">
            <div ref={printRef}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  backgroundColor: 'var(--apg-bg-page)',
                  padding: '16px',
                  maxWidth: '720px',
                  margin: '0 auto',
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 60%, var(--apg-aviation-navy-light))',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src="/assets/tanphu-apg-logo.jpg"
                          alt="Logo"
                          style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'contain' }}
                        />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: '16px', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>
                          TAN PHU APG
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>Corporate Aviation Services</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '9px' }}>Mã báo giá</div>
                      <div style={{ color: 'white', fontWeight: 800, fontSize: '11px', fontFamily: 'monospace' }}>
                        APG-{new Date(data.createdAt).getTime().toString(36).toUpperCase().slice(-6)}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.25)',
                      paddingTop: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    <span>{isRT ? '↔ Khứ hồi' : '→ Một chiều'} · {cabinLabel(data.cabin)}</span>
                    <span>
                      {data.adults} NL{data.children ? ` · ${data.children} TE` : ''} · {routeAirportLabel(airports, data.outbound.departure, data.outbound.arrival)}
                    </span>
                  </div>
                </div>

                {[
                  { label: isRT ? '✈ CHIỀU ĐI' : '✈ CHUYẾN BAY', flight: data.outbound, date: data.search.date, price: ed.outPrice },
                  ...(isRT && data.inbound
                    ? [{ label: '✈ CHIỀU VỀ', flight: data.inbound, date: data.search.returnDate, price: ed.inPrice }]
                    : []),
                ].map(({ label, flight, date, price }) => {
                  const color = airlineColor(flight.airlineCode);
                  const meta = getAirlineMeta(flight.airlineCode, flight.airline, flight.airlineLogo);
                  const layovers = buildLayovers(flight.detailUrl);
                  return (
                    <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid var(--apg-border-default)', marginBottom: '10px', overflow: 'hidden' }}>
                      <div style={{ background: color, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em' }}>{label}</span>
                        <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900, padding: '4px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.24)' }}>
                          {longDate(date)}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {meta.logo && (
                          <img
                            src={meta.logo}
                            alt={flight.airline}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain', border: '1px solid #eee', background: 'white', padding: '2px' }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '22px', fontWeight: 900, color: '#1a1a1a' }}>{hhmm(flight.departure.time)}</span>
                            <span style={{ color: 'var(--apg-text-secondary)', fontSize: '13px' }}>→</span>
                            <span style={{ fontSize: '22px', fontWeight: 900, color: '#1a1a1a' }}>{hhmm(flight.arrival.time)}</span>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{durationText(flight.duration)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#777' }}>
                            {flight.airline} · {flight.flightNumber} · {flight.stops === 0 ? 'Bay thẳng' : `${flight.stops} điểm dừng`}
                          </div>
                          <div style={{ fontSize: '13px', color: '#888' }}>
                            {routeAirportLabel(airports, flight.departure, flight.arrival)}
                          </div>
                        </div>
                        {showTicketFare ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.2 }}>{formatTicketMoney(price)}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>/người</div>
                          </div>
                        ) : null}
                      </div>
                      {layovers.length > 0 && (
                        <div style={{ borderTop: '1px solid #f0ebe0', background: '#fcfaf6', padding: '10px 14px' }}>
                          {layovers.map((stop, idx) => (
                            <div key={`${stop.airport}-${idx}`} style={{ background: 'white', border: '1px solid var(--apg-border-default)', borderRadius: '8px', padding: '10px 12px', marginBottom: idx < layovers.length - 1 ? '8px' : '0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                                <div style={{ fontWeight: 700, color: '#1a1a1a' }}>
                                  {airportLabel(stop.fromSegment.from)} → {airportLabel(stop.fromSegment.to)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#777' }}>{longDateFromAbayText(stop.fromSegment.departDate)}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                {meta.logo && (
                                  <img
                                    src={meta.logo}
                                    alt={flight.airline}
                                    style={{ width: '22px', height: '22px', borderRadius: '5px', objectFit: 'contain', border: '1px solid #eee', background: 'white', padding: '2px' }}
                                  />
                                )}
                                <div style={{ flex: 1, fontSize: '12px', color: '#555' }}>{stop.fromSegment.flightNumber}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{formatMinutesShort(stop.fromSegment.durationMinutes)}</div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a1a1a' }}>
                                  {stop.fromSegment.departHm} - {stop.fromSegment.arriveHm}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 8px 2px' }}>
                                <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#f97316' }} />
                                </div>
                                <div style={{ width: '1px', height: '28px', background: '#f1d9b5' }} />
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ea580c' }}>Nối chuyến: {stop.durationText}</div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                                <div style={{ fontWeight: 700, color: '#1a1a1a' }}>
                                  {airportLabel(stop.toSegment.from)} → {airportLabel(stop.toSegment.to)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#777' }}>{longDateFromAbayText(stop.toSegment.departDate)}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                {meta.logo && (
                                  <img
                                    src={meta.logo}
                                    alt={flight.airline}
                                    style={{ width: '22px', height: '22px', borderRadius: '5px', objectFit: 'contain', border: '1px solid #eee', background: 'white', padding: '2px' }}
                                  />
                                )}
                                <div style={{ flex: 1, fontSize: '12px', color: '#555' }}>{stop.toSegment.flightNumber}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{formatMinutesShort(stop.toSegment.durationMinutes)}</div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a1a1a' }}>
                                  {stop.toSegment.departHm} - {stop.toSegment.arriveHm}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {showTicketFare ? (
                  <div style={{ background: 'white', borderRadius: '10px', border: '1px solid var(--apg-border-default)', marginBottom: '10px', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--apg-bg-surface-soft)', borderBottom: '1px solid var(--apg-border-default)', padding: '6px 12px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#7a6a52', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Chi tiết giá vé
                      </span>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      {[
                        [`NL × ${data.adults}`, Math.round(farePerPax * data.adults)],
                        [`Thuế ~${ed.taxPct}%`, tax],
                      ].map(([label, value]) => (
                        <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '5px' }}>
                          <span>{label}</span>
                          <span style={{ fontWeight: 600, color: '#333' }}>{formatTicketMoney(Number(value))}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--apg-border-default)', marginTop: '6px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4a3b28' }}>Tổng giá vé</div>
                          <div style={{ fontSize: '9px', color: '#aaa' }}>* Tham khảo</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.2 }}>{formatTicketMoney(grandTotal)}</div>
                          <div style={{ fontSize: '9px', color: '#bbb' }}>{`≈$${Math.round(grandTotal / usdRate)} USD`}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    background: 'linear-gradient(180deg, rgba(242,247,252,0.96), rgba(255,255,255,0.98) 30%, rgba(250,246,238,0.98) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(20,59,95,0.16)',
                    marginBottom: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 12px 28px rgba(20,59,95,0.08)',
                  }}
                >
                  <div
                    style={{
                      padding: '9px 14px',
                      background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    Lưu ý
                  </div>
                  <div style={{ padding: '13px 14px 14px', color: '#425266', fontSize: '11px', lineHeight: 1.68 }}>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--apg-aviation-navy-deep)', letterSpacing: '0.01em' }}>{TICKET_NOTICE_INTRO}</div>
                    <ul style={{ margin: '10px 0 0', paddingLeft: '16px', color: '#4b5b70' }}>
                      {TICKET_NOTICE_ITEMS.map((item) => (
                        <li key={item} style={{ marginBottom: '5px' }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(20,59,95,0.06)',
                        border: '1px solid rgba(20,59,95,0.08)',
                        fontWeight: 700,
                        color: 'var(--apg-aviation-navy-deep)',
                      }}
                    >
                      {TICKET_NOTICE_CONFIRM}
                    </div>
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '11px',
                        borderTop: '1px dashed rgba(177,138,59,0.36)',
                        textAlign: 'center',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--apg-brand-gold)',
                      }}
                    >
                      {TICKET_NOTICE_THANKS}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 60%, var(--apg-aviation-navy-light))',
                    borderRadius: '12px',
                    border: '1px solid rgba(20,59,95,0.2)',
                    overflow: 'hidden',
                    marginTop: '12px',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '190px', maxWidth: '220px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '9px',
                          background: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src="/assets/tanphu-apg-logo.jpg"
                          alt="Logo"
                          style={{ width: '34px', height: '34px', borderRadius: '7px', objectFit: 'contain' }}
                        />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: '13px', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>
                          TAN PHU APG
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px' }}>Corporate Aviation Services</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                      {[
                        { label: 'Điện thoại', value: ed.phone, width: '132px' },
                        { label: 'Trang web', value: ed.website, width: '136px' },
                        { label: 'Email', value: ed.email, width: '170px' },
                      ].map(({ label, value, width }) => (
                        <div
                          key={label}
                          style={{
                            minWidth: width,
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.10)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }}
                        >
                          <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '9px', marginBottom: '3px' }}>{label}</div>
                          <div
                            style={{
                              color: 'white',
                              fontSize: label === 'Email' ? '10px' : '11px',
                              fontWeight: 600,
                              lineHeight: 1.25,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.18)',
                      padding: '7px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.74)',
                    }}
                  >
                    <span style={{ maxWidth: '500px', lineHeight: 1.35 }}>* {ed.note}</span>
                    <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{ed.website}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="hidden min-h-0 border-l border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] lg:flex lg:flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div className="apg-panel px-4 py-4">
                  <div className="apg-eyebrow">Tổng báo giá</div>
                  <div className="apg-tabular mt-2 text-2xl font-black text-[#1a1a1a]">{fmtVND(grandTotal)}</div>
                  <div className="mt-1 text-xs text-slate-500">≈${Math.round(grandTotal / usdRate)} USD · {data.adults} khách</div>
                  <div className="mt-3 rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-3 text-xs text-slate-600">
                    {routeAirportLabel(airports, data.outbound.departure, data.outbound.arrival)}
                    {isRT ? ` · Khứ hồi` : ` · Một chiều`}
                  </div>
                </div>

                <div className="apg-panel px-4 py-4">
                  <div className="apg-eyebrow">Cài Đặt Nâng Cao</div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--apg-border-default)] bg-white px-3 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[#1a1a1a]">{locked ? 'Đang khóa cài đặt' : 'Đã mở chỉnh sửa'}</div>
                      <div className="text-xs text-slate-500">{locked ? 'Chỉ xem trước và tải mặt vé.' : 'Có thể cập nhật giá, liên hệ và ghi chú.'}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${locked ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                      {locked ? 'Khóa' : 'Đã mở'}
                    </span>
                  </div>
                  {locked ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-semibold text-[#7a6a52]">
                        Mật khẩu
                        <input
                          type="password"
                          value={pwInput}
                          onChange={(event) => setPwInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            if (pwInput === UNLOCK_PASSWORD) {
                              setLocked(false);
                              setPwError('');
                            } else {
                              setPwError('Sai mật khẩu');
                              setPwInput('');
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                      {pwError && <div className="text-xs text-red-500">{pwError}</div>}
                      <button
                        onClick={() => {
                          if (pwInput === UNLOCK_PASSWORD) {
                            setLocked(false);
                            setPwError('');
                          } else {
                            setPwError('Sai mật khẩu');
                            setPwInput('');
                          }
                        }}
                        className="apg-btn-primary h-11 w-full text-sm font-bold text-white"
                      >
                        Mở Cài đặt
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLocked(true)}
                      className="apg-btn-secondary mt-3 h-11 w-full text-sm font-semibold"
                    >
                      Khóa lại
                    </button>
                  )}
                </div>

                {!locked && (
                  <div className="apg-panel px-4 py-4">
                    <div className="apg-eyebrow">Nội dung báo giá</div>
                    <div className="mt-3 grid gap-3 text-xs">
                      <label className="font-semibold text-[#7a6a52]">
                        Giá đi (VND)
                        <input
                          type="number"
                          value={ed.outPrice}
                          onChange={(event) => setEd((prev) => ({ ...prev, outPrice: Number(event.target.value) }))}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                      {isRT && (
                        <label className="font-semibold text-[#7a6a52]">
                          Giá về (VND)
                          <input
                            type="number"
                            value={ed.inPrice}
                            onChange={(event) => setEd((prev) => ({ ...prev, inPrice: Number(event.target.value) }))}
                            className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                          />
                        </label>
                      )}
                      <label className="font-semibold text-[#7a6a52]">
                        Thuế %
                        <input
                          type="number"
                          value={ed.taxPct}
                          onChange={(event) => setEd((prev) => ({ ...prev, taxPct: Number(event.target.value) }))}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="font-semibold text-[#7a6a52]">
                        Điện thoại
                        <input
                          value={ed.phone}
                          onChange={(event) => setEd((prev) => ({ ...prev, phone: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="font-semibold text-[#7a6a52]">
                        Trang web
                        <input
                          value={ed.website}
                          onChange={(event) => setEd((prev) => ({ ...prev, website: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="font-semibold text-[#7a6a52]">
                        Email
                        <input
                          value={ed.email}
                          onChange={(event) => setEd((prev) => ({ ...prev, email: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-5 py-4">
                <div className="grid gap-3">
                  <button
                    onClick={() => setShowTicketFare((prev) => !prev)}
                    className="apg-btn-secondary inline-flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
                  >
                    {showTicketFare ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showTicketFare ? 'Ẩn giá vé' : 'Hiện giá vé'}
                  </button>
                  <div className="px-1 text-center text-[11px] text-slate-500">Chỉ áp dụng trên mặt vé báo giá và file xuất ra.</div>
                  <button
                    onClick={handleJPEG}
                    disabled={!!exporting}
                    className="apg-btn-secondary h-12 w-full text-sm font-semibold disabled:opacity-60"
                  >
                    {exporting === 'jpg' ? 'Đang xuất...' : 'Tải JPEG'}
                  </button>
                  <button
                    onClick={handlePDF}
                    disabled={!!exporting}
                    className="apg-btn-primary h-12 w-full text-sm font-bold text-white disabled:opacity-60"
                  >
                    {exporting === 'pdf' ? 'Đang xuất...' : 'Tải PDF'}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-[var(--apg-border-default)] px-4 py-3 lg:hidden">
          <div className="grid gap-2">
            <button
              onClick={() => setShowTicketFare((prev) => !prev)}
              className="apg-btn-secondary inline-flex h-10 w-full items-center justify-center gap-2 text-xs font-semibold"
            >
              {showTicketFare ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showTicketFare ? 'Ẩn giá vé' : 'Hiện giá vé'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleJPEG}
                disabled={!!exporting}
                className="apg-btn-secondary flex-1 h-10 text-xs font-semibold disabled:opacity-60"
              >
                {exporting === 'jpg' ? 'Đang xuất...' : 'Tải JPEG'}
              </button>
              <button
                onClick={handlePDF}
                disabled={!!exporting}
                className="apg-btn-primary flex-1 h-10 text-xs font-bold text-white disabled:opacity-60"
              >
                {exporting === 'pdf' ? 'Đang xuất...' : 'Tải PDF'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function QuotePage() {
  const router = useRouter();
  const { airports } = useAirports();
  const [data, setData] = useState<QuotePayload | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [usdRate, setUsdRate] = useState<number>(26357);

  useEffect(() => {
    const raw = localStorage.getItem('apg_quote_selection');
    if (!raw) return;
    try {
      setData(JSON.parse(raw));
    } catch {
      // ignore invalid local storage data
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/exchange-rate', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const r = Number(j?.rate);
        if (!cancelled && Number.isFinite(r) && r > 0) setUsdRate(r);
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const calc = useMemo(() => {
    if (!data) return null;
    const outAmt = data.outbound.fareBreakdown?.totalAmount ?? data.outbound.price.amount;
    const inAmt = data.inbound?.fareBreakdown?.totalAmount ?? data.inbound?.price.amount ?? 0;
    const farePerPax = outAmt + inAmt;
    const totalAdults = farePerPax * data.adults;
    const taxAdults =
      (data.outbound.fareBreakdown?.taxesFees ?? 0) * data.adults +
      (data.inbound?.fareBreakdown?.taxesFees ?? 0) * data.adults;
    const baseAdults =
      (data.outbound.fareBreakdown?.baseAmount ?? outAmt) * data.adults +
      (data.inbound?.fareBreakdown?.baseAmount ?? inAmt) * data.adults;
    return {
      farePerPax,
      baseAdults,
      taxAdults,
      total: Math.round(totalAdults),
    };
  }, [data]);

  const ancillaryPayload = useMemo(() => {
    if (!data) return null;
    return {
      flight: data.outbound,
      outbound: data.outbound,
      inbound: data.tripType === 'roundtrip' ? data.inbound : null,
      tripType: data.tripType,
      search: data.search,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      cabin: data.cabin,
    };
  }, [data]);

  const warmAncillaries = useCallback(() => {
    if (!ancillaryPayload) return;
    prefetchAncillaryResponse(ancillaryPayload);
  }, [ancillaryPayload]);

  const openHoldModal = useCallback(() => {
    warmAncillaries();
    setHoldOpen(true);
  }, [warmAncillaries]);

  if (!data || !calc) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f5f0e8' }}>
        <div className="max-w-xs rounded-xl bg-white p-6 text-center shadow-md">
          <div className="mb-2 text-3xl">✈️</div>
          <p className="mb-4 text-sm text-[#666]">Chưa có dữ liệu báo giá.</p>
          <button
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--apg-brand-gold)' }}
            onClick={() => router.push('/')}
          >
            Quay lại tìm vé
          </button>
        </div>
      </main>
    );
  }

  const isRT = data.tripType === 'roundtrip' && !!data.inbound;
  const quoteId = `APG-${new Date(data.createdAt).getTime().toString(36).toUpperCase().slice(-6)}`;
  const passengersText = `${data.adults} người lớn${data.children ? ` · ${data.children} trẻ em` : ''}${data.infants ? ` · ${data.infants} em bé` : ''}`;
  const departureLabel = airportEndpointLabel(airports, data.outbound.departure);
  const arrivalLabel = airportEndpointLabel(airports, data.outbound.arrival);
  const totalUsdLabel = `≈$${Math.round(calc.total / usdRate)} USD`;
  const quoteModeLabel = isRT ? 'Khứ hồi' : 'Một chiều';
  const quoteIssuedAt = new Date(data.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const quoteJourneyText = `${departureLabel} ${isRT ? '⇄' : '→'} ${arrivalLabel}`;
  const holdSummaryCardClassName =
    'rounded-[20px] border border-[#1f5f44] px-4 py-4 text-white shadow-[0_14px_28px_rgba(46,125,91,0.30)]';
  const holdSummaryCardStyle = {
    background: 'linear-gradient(135deg, #1f5f44, var(--apg-success) 55%, #3a9067)',
  };
  const holdPrimaryButtonClassName =
    'mt-3 h-11 w-full rounded-[14px] bg-white text-sm font-bold text-[#1f5f44] shadow-[0_8px_18px_rgba(255,255,255,0.14)] transition hover:bg-emerald-50';
  const contactItems = [
    { icon: Phone, value: '0918.752.686', sub: 'Điện thoại', href: 'tel:0918752686' },
    { icon: Globe, value: 'tanphuapg.com', sub: 'Trang web', href: 'https://tanphuapg.com' },
    { icon: Mail, value: 'tkt.tanphu@gmail.com', sub: 'Email', href: 'mailto:tkt.tanphu@gmail.com' },
  ] as const;

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--apg-bg-page)' }}>
      <div className="mx-auto max-w-[1120px] px-4 pb-8 lg:px-0">
        <div className="border border-[var(--apg-aviation-navy)] lg:mt-4 lg:rounded-t-2xl" style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={() => router.push('/')} className="flex items-center gap-4 text-left">
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-[60px] lg:w-[60px]">
                <img
                  src="/assets/tanphu-apg-logo.jpg"
                  alt="Logo"
                  className="h-10 w-10 rounded-[8px] object-contain lg:h-[46px] lg:w-[46px]"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <div className="apg-display text-[15px] font-semibold tracking-[0.08em] text-white">TAN PHU APG</div>
                <div className="text-[10px] tracking-[0.04em] text-white/70">Corporate Aviation Services</div>
              </div>
            </button>
            <div className="rounded-[var(--apg-radius-md)] border border-white/10 bg-white/10 px-3 py-2 text-right">
              <div className="apg-display text-[9px] font-medium tracking-[0.16em] text-white/70">Mã báo giá</div>
              <div className="apg-mono text-xs font-black text-white">{quoteId}</div>
            </div>
          </div>
          <div className="flex justify-between border-t border-white/20 bg-white/10 px-4 py-1.5 text-[10px] text-white/80">
            <span>{isRT ? '↔ Khứ hồi' : '→ Một chiều'} · {cabinLabel(data.cabin)}</span>
            <span>{new Date(data.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="space-y-6 lg:pt-6">
          <section className="overflow-hidden bg-white lg:rounded-2xl lg:border lg:border-[var(--apg-border-default)] lg:shadow-sm">
            <div className="bg-white px-4 py-3" style={{ borderBottom: '1px solid var(--apg-border-default)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 text-left">
                  <div className="apg-display max-w-[520px] text-[18px] font-semibold leading-tight text-[var(--apg-aviation-navy)] lg:text-[20px]">
                    {departureLabel}
                  </div>
                </div>
                <span className="text-base text-[var(--apg-brand-gold)]">{isRT ? '⇄' : '→'}</span>
                <div className="min-w-0 text-left">
                  <div className="apg-display max-w-[520px] text-[18px] font-semibold leading-tight text-[var(--apg-aviation-navy)] lg:text-[20px]">
                    {arrivalLabel}
                  </div>
                </div>
                <span className="mx-1 text-[#ddd]">|</span>
                <span className="text-xs text-[#666]">{passengersText}</span>
              </div>
            </div>

            <div className="space-y-2 bg-white px-3 py-3" style={{ borderBottom: '1px solid var(--apg-border-default)' }}>
              <FlightSegment
                label={isRT ? '✈ CHIỀU ĐI' : '✈ CHUYẾN BAY'}
                flight={data.outbound}
                date={data.search.date}
                color={airlineColor(data.outbound.airlineCode)}
              />
              {isRT && data.inbound && (
                <FlightSegment
                  label="✈ CHIỀU VỀ"
                  flight={data.inbound}
                  date={data.search.returnDate}
                  color={airlineColor(data.inbound.airlineCode)}
                />
              )}
            </div>

            <div className="bg-white px-3 py-3">
              <div className="apg-display mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--apg-brand-gold)]">Chi tiết giá vé</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#555]">
                  <span>Người lớn × {data.adults}</span>
                  <span className="font-semibold text-[#333]">{fmtVND(calc.baseAdults)}</span>
                </div>
                <div className="flex justify-between text-[#555]">
                  <span>Thuế + phí</span>
                  <span className="font-semibold">{fmtVND(calc.taxAdults)}</span>
                </div>
                {data.children > 0 && (
                  <div className="flex justify-between text-[#555]">
                    <span>Trẻ em × {data.children}</span>
                    <span className="font-semibold">{fmtVND(Math.round(calc.farePerPax * 0.75 * data.children))}</span>
                  </div>
                )}
                {data.infants > 0 && (
                  <div className="flex justify-between text-[#555]">
                    <span>Em bé × {data.infants}</span>
                    <span className="font-semibold">{fmtVND(Math.round(calc.farePerPax * 0.1 * data.infants))}</span>
                  </div>
                )}
              </div>
              <div
                className="mt-3 flex items-center justify-between rounded-xl px-3 py-3"
                style={{ background: 'linear-gradient(135deg, var(--apg-bg-surface-soft), white)', border: '1px solid var(--apg-border-default)' }}
              >
                <div>
                  <div className="apg-display text-xs font-medium uppercase tracking-[0.16em] text-[var(--apg-brand-gold)]">Tổng giá vé</div>
                  <div className="text-[9px] text-[#aaa]">* Tham khảo</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#1a1a1a]">{fmtVND(calc.total)}</div>
                  <div className="text-[9px] text-[#bbb]">{totalUsdLabel}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="apg-panel overflow-hidden">
            <div className="border-b border-[var(--apg-border-default)] px-4 py-3 lg:px-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="apg-eyebrow">Báo giá</div>
                <div className="rounded-full border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--apg-text-secondary)]">
                  {quoteModeLabel}
                </div>
              </div>
            </div>

            <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_392px] lg:items-stretch lg:px-5 lg:py-5">
              <div className="flex h-full flex-col justify-between rounded-[16px] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-4">
                <div>
                  <div className="apg-mono text-[24px] font-black text-[#1a1a1a] lg:text-[28px]">{quoteId}</div>
                  <div className="mt-1 text-sm text-slate-500">{cabinLabel(data.cabin)} · {passengersText}</div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                  <div className="min-w-0 rounded-[12px] border border-[var(--apg-border-default)] bg-white px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">Hành trình</div>
                    <div className="mt-1 text-sm font-semibold leading-snug text-[#1a1a1a] lg:text-[15px]">{quoteJourneyText}</div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--apg-border-default)] bg-white px-3 py-3 text-left sm:text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-text-secondary)]">Xuất báo giá</div>
                    <div className="mt-1 text-sm font-semibold text-[#1a1a1a]">{quoteIssuedAt}</div>
                  </div>
                </div>
              </div>

              <div className={`${holdSummaryCardClassName} flex h-full flex-col justify-between`} style={holdSummaryCardStyle}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="apg-eyebrow text-white/65">Tổng thanh toán</div>
                    <div className="mt-1 text-[13px] text-white/80">{passengersText}</div>
                  </div>
                  <div className="text-right">
                    <div className="apg-tabular whitespace-nowrap text-[30px] font-black leading-none tracking-tight text-white lg:text-[34px]">{fmtVND(calc.total)}</div>
                    <div className="mt-1 text-[12px] text-white/70">{totalUsdLabel}</div>
                  </div>
                </div>
                <button
                  className={`${holdPrimaryButtonClassName} inline-flex items-center justify-center gap-2`}
                  onMouseEnter={warmAncillaries}
                  onFocus={warmAncillaries}
                  onPointerDown={warmAncillaries}
                  onClick={openHoldModal}
                >
                  Giữ chỗ ngay
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--apg-border-default)] px-4 py-4 lg:px-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  className="apg-btn-secondary inline-flex h-11 items-center justify-center gap-2 text-sm font-bold text-[var(--apg-aviation-navy)]"
                  onClick={() => setShowTicket(true)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Tải mặt vé
                </button>
                <button
                  className="apg-btn-secondary inline-flex h-11 items-center justify-center gap-2 text-sm font-semibold text-[var(--apg-aviation-navy)]"
                  onClick={() => router.push('/')}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Đổi chuyến
                </button>
              </div>
            </div>
          </section>

          <footer
            className="overflow-hidden border border-[var(--apg-aviation-navy)] text-white shadow-sm lg:rounded-2xl"
            style={{ background: 'linear-gradient(135deg, var(--apg-aviation-navy-deep), var(--apg-aviation-navy-mid) 62%, var(--apg-aviation-navy-light))' }}
          >
            <div className="grid gap-5 px-4 py-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-8 lg:px-6 lg:py-6">
              <div className="max-w-[360px]">
                <div className="flex items-center gap-3">
                  <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[10px] border border-white/12 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <img
                      src="/assets/tanphu-apg-logo.jpg"
                      alt="Logo"
                      className="h-9 w-9 rounded-[8px] object-contain"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <div className="apg-display text-[14px] font-semibold tracking-[0.08em] text-white lg:text-[15px]">TAN PHU APG</div>
                    <div className="text-[10px] tracking-[0.04em] text-white/70">Corporate Aviation Services</div>
                  </div>
                </div>
                <p className="mt-3 max-w-[320px] text-[12px] leading-relaxed text-white/75">
                  * Giá tham khảo. Liên hệ TAN PHU APG để xác nhận chính xác trước khi giữ chỗ hoặc phát hành vé.
                </p>
              </div>

              <div className="min-w-0">
                <div className="apg-eyebrow text-white/55">Liên hệ</div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {contactItems.map(({ icon: Icon, value, sub, href }) => (
                  <a
                    key={sub}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                    className={`group flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.08] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/18 hover:bg-white/[0.12] ${
                      sub === 'Email' ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/10 text-white/90 transition group-hover:bg-white/14">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold leading-tight text-white ${sub === 'Email' ? 'break-all text-[13px] sm:text-[14px]' : 'text-[14px]'}`}>
                        {value}
                      </span>
                      <span className="mt-1 block text-[11px] text-white/60">{sub}</span>
                    </span>
                  </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-white/10 bg-black/10 px-4 py-2.5 text-center text-[10px] text-white/85 lg:px-6">
              <span>© 2026 TAN PHU APG</span>
              <span className="text-white/30">·</span>
              <span>MST: <span className="apg-mono tabular-nums">4600111735</span></span>
              <span className="text-white/30">·</span>
              <span>tanphuapg.com</span>
            </div>
          </footer>
        </div>
      </div>

      {showTicket && <TicketModal data={data} onClose={() => setShowTicket(false)} usdRate={usdRate} />}
      <HoldBookingModal
        flight={data.outbound}
        inbound={isRT ? data.inbound : null}
        tripType={data.tripType}
        search={data.search}
        adults={data.adults}
        children={data.children}
        infants={data.infants}
        cabin={data.cabin}
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
      />
    </main>
  );
}
