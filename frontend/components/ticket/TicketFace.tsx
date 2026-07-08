'use client';

import Image from 'next/image';
import AirlineLogo from '@/components/flight/AirlineLogo';
import { PHONE_DISPLAY } from '@/lib/site';
import './ticket-face.css';

// Mặt vé Tan Phu APG dùng chung cho 3 trạng thái: Báo giá / Giữ chỗ / Đã thanh toán.
// Bộ khung không đổi; chỉ chip trạng thái, mã tham chiếu, và vùng giá/thanh toán đổi theo `status`.
// LƯU Ý in: dùng hex cứng navy/gold theo redesign-2026, KHÔNG dùng var(--apg-*) (token đã alias gold→xanh).

export type TicketStatus = 'quote' | 'hold' | 'paid';

export interface TicketLeg {
  direction: 'outbound' | 'return';
  weekday: string;        // "Thứ 3"
  dateLabel: string;      // "23/06"
  airlineCode: string;    // "VJ"
  airline: string;        // "Vietjet Air"
  airlineLogo?: string;
  flightNumber: string;   // "VJ161"
  aircraft?: string;      // "A321"
  fareClass: string;      // "Phổ thông"
  baggageChecked: string; // "20kg ký gửi"
  baggageCarryOn: string; // "7kg xách tay"
  stopsLabel: string;     // "Bay thẳng" / "1 điểm dừng"
  durationLabel: string;  // "2g 10m"
  depTime: string;        // "20:55"
  arrTime: string;        // "23:05"
  depCity: string;        // "Hà Nội"
  arrCity: string;        // "TP. Hồ Chí Minh"
  depCode: string;        // "HAN"
  arrCode: string;        // "SGN"
  depAirport: string;     // "Nội Bài (T1)"
  arrAirport: string;     // "Tân Sơn Nhất (T1)"
}

export interface TicketPassenger {
  index: number;
  title: 'MR' | 'MRS' | 'MS' | 'MSTR' | 'MISS';
  fullName: string;       // "NGUYEN VAN AN"
  dobLabel?: string;      // "12/05/1990" — chỉ hiện khi có dữ liệu thật
  ticketNumber?: string;  // chỉ Paid
}

export interface TicketPriceLines {
  baseFare: number;
  taxesAndFees: number;
  baggageTotal?: number;
  total: number;
  segmentsLabel?: string; // "2 chặng"
}

export interface TicketHoldData {
  amountDue: number;
  bankCode: string;        // "BIDV"
  bankAccount: string;     // "96247 558 868"
  bankAccountName?: string;
  transferContent: string; // "APGVKA91"
  qrImageUrl: string;      // QR data URL hoặc URL VietQR
  deadlineLabel: string;   // "17:30 ngày 24/06"
  countdownLabel: string;  // "02:58:12"
}

export interface TicketPaidData {
  totalPaid: number;
  paidAtLabel: string;     // "23/06/2026 16:42"
  issuedDateLabel: string; // "23/06/2026"
}

export interface TicketQuoteData {
  validUntilLabel: string; // "17:30 24/06/2026"
}

export interface TicketProps {
  status: TicketStatus;
  referenceCode: string;   // quote code APG-xxxx hoặc PNR APGVKA91
  legs: TicketLeg[];
  passengers: TicketPassenger[];
  price: TicketPriceLines;
  quote?: TicketQuoteData;
  hold?: TicketHoldData;
  paid?: TicketPaidData;
  showPrice?: boolean;     // toggle agent — mặc định: hiện cho Báo giá/Giữ chỗ, ẩn cho Đã thanh toán
  hotline?: string;        // mặc định 0943 557 959
  email?: string;          // mặc định tkt.tanphu@gmail.com
  website?: string;        // mặc định tanphuapg.com
}

const NAVY = '#0C2740';
const NAVY_GRAD = 'linear-gradient(135deg,#0E2A47,#143A5C 60%,#1A4E78)';
const LEG_OUT = 'linear-gradient(135deg,#0E2A47,#143A5C)';
const LEG_RET = 'linear-gradient(135deg,#5A2330,#7A3A48 58%,#1A4B74)';
const GOLD = '#C7A24C';
const GOLD_SOFT_FILL = 'rgba(199,162,76,.12)';
const GOLD_SOFT_BORDER = 'rgba(199,162,76,.55)';
const GOLD_TEXT = '#E3C77A';
const HAIRLINE = '#D2D2D7';
const PAGE_BG = '#EEF1F4';
const NAVY_SOFT_FILL = '#EEF6FC';
const NAVY_SOFT_BORDER = '#DCEAF6';

function fmtVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

function defaultShowPrice(status: TicketStatus): boolean {
  if (status === 'paid') return false;
  return true; // quote luôn hiện; hold mặc định hiện
}

function StatusChip({ status }: { status: TicketStatus }) {
  if (status === 'quote') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 980, padding: '4px 10px', fontSize: 11, fontWeight: 700, border: `1px solid ${GOLD_SOFT_BORDER}`, background: NAVY, color: GOLD_TEXT }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        <span>BÁO GIÁ</span>
      </span>
    );
  }
  if (status === 'hold') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 980, padding: '4px 10px', fontSize: 11, fontWeight: 700, border: '1px solid #EF9F27', background: '#FDF0DD', color: '#854F0B' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        <span>GIỮ CHỖ · CHỜ THANH TOÁN</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 980, padding: '4px 10px', fontSize: 11, fontWeight: 700, border: '1px solid #BFE0CC', background: '#E7F6EC', color: '#0F7B43' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
      <span>ĐÃ THANH TOÁN</span>
    </span>
  );
}

function ReferencePill({ value }: { value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${GOLD_SOFT_BORDER}`, background: GOLD_SOFT_FILL, borderRadius: 980, padding: '3px 13px', flexShrink: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7A5A12' }}>MÃ ĐẶT CHỖ</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace', color: NAVY, letterSpacing: '.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </span>
  );
}

function LegCard({ leg }: { leg: TicketLeg }) {
  const isReturn = leg.direction === 'return';
  return (
    <div style={{ border: `0.5px solid ${HAIRLINE}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,24,40,.06)', background: '#fff', marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 13px', color: '#fff', gap: 10, background: isReturn ? LEG_RET : LEG_OUT }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', background: 'rgba(255,255,255,.16)', borderRadius: 5, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {isReturn ? '✈ CHIỀU VỀ' : '✈ CHIỀU ĐI'}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {leg.depCity} <span style={{ color: GOLD_TEXT }}>→</span> {leg.arrCity}
          </span>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, background: 'rgba(255,255,255,.16)', borderRadius: 6, padding: '2px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {leg.weekday} · {leg.dateLabel}
        </span>
      </div>
      <div className="tk-leg-body">
        <div className="tk-leg-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AirlineLogo code={leg.airlineCode} airline={leg.airline} logo={leg.airlineLogo} size={26} />
            <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
              {leg.airline} · {leg.flightNumber} · {leg.stopsLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 7 }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#16212B', fontVariantNumeric: 'tabular-nums' }}>{leg.depTime}</span>
            <span style={{ color: '#9aa5b1' }}>→</span>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#16212B', fontVariantNumeric: 'tabular-nums' }}>{leg.arrTime}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#93A0AC', marginLeft: 2 }}>{leg.durationLabel}</span>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: '#586675', marginTop: 3 }}>
            {leg.depCode} · {leg.depAirport} &nbsp;→&nbsp; {leg.arrCode} · {leg.arrAirport}
          </div>
        </div>
        <div className="tk-leg-meta">
          <MetaLine label="Số hiệu" value={leg.flightNumber} />
          {leg.aircraft && <MetaLine label="Tàu bay" value={leg.aircraft} />}
          <MetaLine label="Hạng vé" value={leg.fareClass} />
          <MetaLine label="Hành lý" value={`${leg.baggageChecked} · ${leg.baggageCarryOn}`} />
        </div>
      </div>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: '#8893A0' }}>{label} </span>
      <b style={{ fontWeight: 600, color: '#16212B' }}>{value}</b>
    </div>
  );
}

function StubSeam() {
  return (
    <div style={{ position: 'relative', height: 16, margin: '11px 0 0' }}>
      <div style={{ position: 'absolute', top: '50%', left: 14, right: 14, borderTop: '1.5px dashed #CBD2DA' }} />
      <div style={{ position: 'absolute', top: '50%', left: -9, width: 18, height: 18, borderRadius: '50%', background: PAGE_BG, transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', top: '50%', right: -9, width: 18, height: 18, borderRadius: '50%', background: PAGE_BG, transform: 'translateY(-50%)' }} />
    </div>
  );
}

function PassengerTable({ passengers, showTicketNumbers }: { passengers: TicketPassenger[]; showTicketNumbers: boolean }) {
  const thStyle: React.CSSProperties = { fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#586675', fontWeight: 700, padding: '3px 10px', textAlign: 'left' };
  const tdStyle: React.CSSProperties = { padding: '4px 10px', borderTop: '0.5px solid #ECEEF1', verticalAlign: 'middle' };
  return (
    <div style={{ border: '0.5px solid #E2E6EB', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: NAVY_SOFT_FILL }}>
            <th style={{ ...thStyle, width: 30 }}>#</th>
            <th style={thStyle}>Quý danh · Họ tên</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Số vé</th>
          </tr>
        </thead>
        <tbody>
          {passengers.map((p, i) => (
            <tr key={p.index} style={i % 2 === 1 ? { background: '#FAFBFC' } : undefined}>
              <td style={tdStyle}>
                <span style={{ display: 'grid', placeItems: 'center', width: 17, height: 17, borderRadius: '50%', background: NAVY, color: '#fff', fontSize: 10, fontWeight: 700 }}>{p.index}</span>
              </td>
              <td style={tdStyle}>
                <span style={{ background: NAVY_SOFT_FILL, color: '#143A5C', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 5px', marginRight: 6 }}>{p.title}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#16212B' }}>{p.fullName}</span>
                {p.dobLabel && (
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: '#8893A0', marginTop: 1 }}>Ngày sinh: {p.dobLabel}</span>
                )}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace', fontWeight: 600, fontSize: 11.5, color: showTicketNumbers && p.ticketNumber ? '#16212B' : '#586675' }}>
                {showTicketNumbers && p.ticketNumber ? p.ticketNumber : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriceCard({ price, footerNote }: { price: TicketPriceLines; footerNote?: React.ReactNode }) {
  const line: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 500, color: '#586675', marginBottom: 2 };
  const lineValue: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', color: '#16212B', fontWeight: 600 };
  return (
    <div style={{ background: NAVY_SOFT_FILL, border: `0.5px solid ${NAVY_SOFT_BORDER}`, borderRadius: 10, padding: '7px 12px' }}>
      <div style={line}>
        <span>Giá vé{price.segmentsLabel ? ` (${price.segmentsLabel})` : ''}</span>
        <span style={lineValue}>{fmtVND(price.baseFare)}</span>
      </div>
      {price.taxesAndFees > 0 && (
        <div style={line}>
          <span>Thuế &amp; phí</span>
          <span style={lineValue}>{fmtVND(price.taxesAndFees)}</span>
        </div>
      )}
      {price.baggageTotal != null && price.baggageTotal > 0 && (
        <div style={line}>
          <span>Hành lý ký gửi</span>
          <span style={lineValue}>{fmtVND(price.baggageTotal)}</span>
        </div>
      )}
      <div style={{ borderTop: '1.5px solid #C9DCEC', margin: '4px 0 3px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>Tổng cộng</span>
        <span style={{ fontFamily: 'var(--font-serif), Fraunces, Georgia, serif', fontSize: 22, fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{fmtVND(price.total)}</span>
      </div>
      {footerNote && (
        <div style={{ marginTop: 4, fontSize: 10.5, fontStyle: 'italic', color: '#7A5A12', lineHeight: 1.4 }}>{footerNote}</div>
      )}
    </div>
  );
}

function QuoteValueZone({ price, quote, hotline }: { price: TicketPriceLines; quote: TicketQuoteData; hotline: string }) {
  return (
    <PriceCard
      price={price}
      footerNote={(
        <>Giá giữ trong ngày · có hiệu lực đến <b style={{ fontWeight: 700 }}>{quote.validUntilLabel}</b>. Xác nhận giữ chỗ qua hotline <b style={{ fontWeight: 700, color: NAVY }}>{hotline}</b>.</>
      )}
    />
  );
}

function HoldValueZone({ price, hold, hotline, showPrice }: { price: TicketPriceLines; hold: TicketHoldData; hotline: string; showPrice: boolean }) {
  if (!showPrice) {
    return (
      <div style={{ border: '0.5px solid #E2E6EB', background: '#FBFBFD', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#586675' }}>
        Thông tin thanh toán được gửi riêng. Vui lòng liên hệ phòng vé · Hotline <b style={{ fontWeight: 700, color: NAVY }}>{hotline}</b>.
      </div>
    );
  }
  return (
    <>
      <div className="tk-hold-grid">
        <div style={{ background: NAVY_SOFT_FILL, border: `0.5px solid ${NAVY_SOFT_BORDER}`, borderRadius: 11, padding: '11px 13px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7A8794' }}>Số tiền cần thanh toán</div>
          <div style={{ fontFamily: 'var(--font-serif), Fraunces, Georgia, serif', fontSize: 22, fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtVND(hold.amountDue)}</div>
          <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 500, color: '#586675', lineHeight: 1.75 }}>
            Ngân hàng <b style={{ fontWeight: 700, color: '#16212B' }}>{hold.bankCode}</b><br />
            Số TK <span style={{ fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace', fontWeight: 600, color: '#16212B' }}>{hold.bankAccount}</span>
            {hold.bankAccountName && (
              <>
                <br />Chủ TK <b style={{ fontWeight: 700, color: '#16212B' }}>{hold.bankAccountName}</b>
              </>
            )}
            <br />
            Nội dung CK <span style={{ fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace', fontWeight: 600, color: NAVY, background: NAVY_SOFT_BORDER, padding: '1px 6px', borderRadius: 4 }}>{hold.transferContent}</span>
          </div>
        </div>
        <div style={{ background: '#FFFAF0', border: '0.5px solid #EF9F27', borderRadius: 11, padding: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#854F0B', letterSpacing: '.06em' }}>SEPAY · VietQR</div>
          <div style={{ background: '#fff', border: '0.5px solid #ECD9B6', borderRadius: 8, padding: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hold.qrImageUrl} alt="QR thanh toán" width={100} height={100} style={{ display: 'block', width: 100, height: 100 }} />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 500, color: '#854F0B', textAlign: 'center' }}>Quét mã QR ngân hàng để thanh toán</div>
        </div>
      </div>
      <div style={{ marginTop: 9, background: '#FDF0DD', border: '0.5px solid #EF9F27', borderRadius: 9, padding: '8px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#854F0B', display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 15"/><polyline points="5 3 2 6"/><polyline points="22 6 19 3"/></svg>
          Thanh toán trước <b style={{ fontWeight: 700 }}>{hold.deadlineLabel}</b> — quá hạn vé tự động huỷ.
        </span>
        <span style={{ fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#b25e00', fontVariantNumeric: 'tabular-nums' }}>{hold.countdownLabel}</span>
      </div>
    </>
  );
}

function PaidValueZone({ price, paid, showPrice }: { price: TicketPriceLines; paid: TicketPaidData; showPrice: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F2F9F4', border: '0.5px solid #BFE0CC', borderRadius: 11, padding: '12px 15px' }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', border: '2px solid #0F7B43', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#0F7B43' }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {showPrice ? (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#3B6D11' }}>Tổng đã thanh toán</div>
            <div style={{ fontFamily: 'var(--font-serif), Fraunces, Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0F7B43', fontVariantNumeric: 'tabular-nums' }}>{fmtVND(paid.totalPaid)}</div>
          </>
        ) : (
          <div style={{ fontFamily: 'var(--font-serif), Fraunces, Georgia, serif', fontSize: 19, fontWeight: 700, color: '#0F7B43' }}>Đã thanh toán đủ</div>
        )}
        <div style={{ fontSize: 11.5, fontWeight: 500, color: '#586675', marginTop: 2 }}>Đã xuất vé · {paid.paidAtLabel} · Sẵn sàng bay</div>
      </div>
      <div style={{ textAlign: 'center', color: '#0F7B43', border: '1.5px dashed #BFE0CC', borderRadius: 8, padding: '5px 9px', transform: 'rotate(-5deg)', flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em' }}>ISSUED</div>
        <div style={{ fontSize: 11, fontWeight: 500 }}>{paid.issuedDateLabel}</div>
      </div>
    </div>
  );
}

const LUU_Y_BULLETS = [
  'Quầy thủ tục đóng trước 60 phút so với giờ khởi hành chuyến bay.',
  'Giấy tờ tùy thân: CCCD, hộ chiếu… bản gốc và còn hạn sử dụng theo quy định của pháp luật.',
  'Trẻ em dưới 14 tuổi phải có Giấy khai sinh bản gốc hoặc bản sao y trích lục.',
  'Trẻ em, phụ nữ mang thai, người lớn tuổi vui lòng liên hệ phòng vé để được tư vấn thêm về thủ tục trước khi xuất vé.',
];

export default function TicketFace(props: TicketProps) {
  const {
    status,
    referenceCode,
    legs,
    passengers,
    price,
    quote,
    hold,
    paid,
    hotline = PHONE_DISPLAY,
    email = 'tkt.tanphu@gmail.com',
    website = 'tanphuapg.com',
  } = props;
  const showPrice = props.showPrice ?? defaultShowPrice(status);

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 600,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(16,24,40,.10)',
        color: '#16212B',
        fontFamily: 'var(--font-sans), "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {status === 'quote' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '48%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-23deg)',
            fontFamily: 'var(--font-serif), Fraunces, Georgia, serif',
            fontSize: 64,
            fontWeight: 700,
            color: NAVY,
            opacity: 0.05,
            letterSpacing: '.12em',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 6,
          }}
        >
          BÁO GIÁ
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: NAVY_GRAD, padding: '7px 16px', position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden style={{ position: 'absolute', right: 0, top: 0, width: 200, height: '100%', opacity: 0.12 }}>
          <circle cx="165" cy="30" r="34" fill="none" stroke="#fff" strokeWidth=".6" strokeDasharray="2,3" />
          <path d="M120 8 Q165 2 198 32" fill="none" stroke="#fff" strokeWidth=".7" strokeDasharray="2,3" />
          <path d="M118 50 Q160 64 200 38" fill="none" stroke="#fff" strokeWidth=".7" strokeDasharray="2,3" />
        </svg>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <Image src="/assets/tanphu-apg-logo.jpg" alt="Tan Phu APG" width={26} height={26} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
            <div style={{ color: '#fff', lineHeight: 1.12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Tan Phu APG</div>
              <div style={{ fontSize: 9.5, fontWeight: 400, letterSpacing: '.02em', color: 'rgba(255,255,255,.72)' }}>Corporate Aviation Services</div>
            </div>
          </div>
          <StatusChip status={status} />
        </div>
      </div>

      {/* TITLE + REFERENCE */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: NAVY, textTransform: 'uppercase' }}>Thông tin chuyến bay</div>
          <ReferencePill value={referenceCode} />
        </div>
        {legs.map((leg, i) => (
          <LegCard key={`${leg.direction}-${i}`} leg={leg} />
        ))}
      </div>

      <StubSeam />

      {/* PASSENGER TABLE */}
      <div style={{ padding: '4px 18px 0' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', color: NAVY, textTransform: 'uppercase', marginBottom: 4 }}>Thông tin hành khách</div>
        <PassengerTable passengers={passengers} showTicketNumbers={status === 'paid'} />
      </div>

      {/* VALUE ZONE */}
      <div style={{ padding: '6px 18px 2px' }}>
        {status === 'quote' && quote && <QuoteValueZone price={price} quote={quote} hotline={hotline} />}
        {status === 'hold' && hold && <HoldValueZone price={price} hold={hold} hotline={hotline} showPrice={showPrice} />}
        {status === 'paid' && paid && <PaidValueZone price={price} paid={paid} showPrice={showPrice} />}
      </div>

      {/* LƯU Ý — bỏ ở Báo giá; chỉ hiện khi đã thành booking (giữ chỗ / đã thanh toán) */}
      {status !== 'quote' && (
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{ border: '0.5px solid #E2E6EB', borderRadius: 10, background: '#FBFBFD', padding: '10px 13px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: NAVY, textTransform: 'uppercase', marginBottom: 6 }}>Lưu ý</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#16212B', lineHeight: 1.5 }}>
            Quý khách vui lòng có mặt ở sân bay trước giờ khởi hành <b style={{ fontWeight: 700 }}>90 phút</b> với chuyến bay nội địa và <b style={{ fontWeight: 700 }}>180 phút</b> với chuyến bay quốc tế.
          </div>
          <ul style={{ margin: '3px 0 0', paddingLeft: 16, fontSize: 11, fontWeight: 500, lineHeight: 1.55, color: '#586675' }}>
            {LUU_Y_BULLETS.map((line) => (
              <li key={line} style={{ margin: '2px 0' }}>{line}</li>
            ))}
          </ul>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#16212B', lineHeight: 1.5, marginTop: 6 }}>
            Quý khách vui lòng đọc kỹ mọi thông tin trên vé (họ &amp; tên, hành trình, ngày giờ bay). Tan Phu APG không chịu trách nhiệm về sai sót giấy tờ tùy thân / thông tin sau khi Quý khách đã xác nhận xuất vé.
          </div>
          <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: NAVY, marginTop: 7, paddingTop: 7, borderTop: '0.5px solid #ECEEF1' }}>
            Cảm ơn Quý khách — chúc Quý khách có chuyến bay vui vẻ!
          </div>
        </div>
      </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 12, borderTop: `2px solid ${GOLD}`, background: '#F5F5F7', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/assets/tanphu-apg-logo.jpg" alt="Tan Phu APG" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>TAN PHU APG</span>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, fontWeight: 500, color: '#586675' }}>
          <span>📞 {hotline}</span>
          <span>✉ {email}</span>
          <span>🌐 {website}</span>
        </div>
      </div>
    </div>
  );
}
