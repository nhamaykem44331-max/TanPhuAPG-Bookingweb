import type {
  TicketProps,
  TicketLeg,
  TicketPassenger,
  TicketStatus,
} from '@/components/ticket/TicketFace';

// Map dữ liệu booking (đã chuẩn hoá) sang props cho <TicketFace>.
// Dùng chung cho: màn thanh toán thành công, trang tra cứu đơn, mặt vé giữ chỗ.
// Thiếu dữ liệu (tên sân bay, hành lý, tàu bay…) → degrade an toàn về mã/giá trị mặc định.

export interface TicketSourceLeg {
  direction: 'outbound' | 'return';
  airline: string | null; // mã (VJ) hoặc tên (Vietjet Air)
  flightNumber: string | null;
  from: string | null; // mã sân bay đi
  to: string | null; // mã sân bay đến
  departureAt: string | null; // ISO
  arrivalAt: string | null; // ISO
  cabin: string | null;
  fareClass?: string | null;
  aircraft?: string | null;
  baggageChecked?: string | null;
  baggageCarryOn?: string | null;
}

export interface TicketSourcePassenger {
  type: string; // ADT | CHD | INF
  firstName: string;
  lastName: string;
  ticketNumber?: string | null;
}

export interface TicketSourceHold {
  amountDue: number;
  bankCode: string | null;
  bankAccount: string | null;
  bankAccountName?: string | null;
  transferContent: string;
  qrImageUrl: string | null;
  deadlineIso: string | null;
  countdownLabel?: string;
}

export interface TicketSourcePaid {
  totalPaid: number;
  paidAtIso: string | null;
}

export interface TicketSource {
  status: TicketStatus;
  referenceCode: string;
  legs: TicketSourceLeg[];
  passengers: TicketSourcePassenger[];
  total: number;
  baseFare?: number;
  taxesAndFees?: number;
  baggageTotal?: number;
  hold?: TicketSourceHold;
  paid?: TicketSourcePaid;
  quoteValidUntilIso?: string | null;
  showPrice?: boolean;
}

export interface AirportName {
  city: string;
  name: string;
}

const AIRLINE_NAMES: Record<string, string> = {
  VN: 'Vietnam Airlines',
  VJ: 'Vietjet Air',
  QH: 'Bamboo Airways',
  BL: 'Pacific Airlines',
  VU: 'Vietravel Airlines',
  TR: 'Scoot',
  AK: 'AirAsia',
  BAMBOO: 'Bamboo Airways',
};

const AIRLINE_CODE_BY_NAME = new Map(
  Object.entries(AIRLINE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

const TZ = 'Asia/Ho_Chi_Minh';
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partsInTz(d: Date): { weekday: number; day: string; month: string; hour: string; minute: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  const wdIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday ?? '');
  return {
    weekday: wdIndex,
    day: map.day ?? '--',
    month: map.month ?? '--',
    hour: (map.hour ?? '--').replace('24', '00'),
    minute: map.minute ?? '--',
  };
}

function timeLabel(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '--:--';
  const p = partsInTz(d);
  return `${p.hour}:${p.minute}`;
}

function weekdayLabel(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  return WEEKDAYS[partsInTz(d).weekday] ?? '';
}

function dateLabel(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  const p = partsInTz(d);
  return `${p.day}/${p.month}`;
}

function deadlineLabel(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  const p = partsInTz(d);
  return `${p.hour}:${p.minute} ngày ${p.day}/${p.month}`;
}

function durationLabel(dep: string | null | undefined, arr: string | null | undefined): string {
  const a = parseIso(dep);
  const b = parseIso(arr);
  if (!a || !b) return '';
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  if (mins <= 0 || mins > 24 * 60) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}g ${m}m` : `${m}m`;
}

function airlineCode(airline: string | null): string {
  const a = (airline ?? '').trim();
  if (!a) return '';
  if (/^[A-Z0-9]{2,3}$/i.test(a)) return a.toUpperCase();
  return AIRLINE_CODE_BY_NAME.get(a.toLowerCase()) ?? a.slice(0, 2).toUpperCase();
}

function airlineName(airline: string | null): string {
  const code = airlineCode(airline);
  return AIRLINE_NAMES[code] ?? (airline ?? '').trim() ?? code;
}

function passengerTitle(type: string): TicketPassenger['title'] {
  // Không lưu gender ở namthanhRawJson → suy theo loại khách (mặc định lịch sự).
  const t = (type || 'ADT').toUpperCase();
  if (t === 'CHD') return 'MSTR';
  if (t === 'INF') return 'MSTR';
  return 'MR';
}

function toTicketLeg(leg: TicketSourceLeg, airportNames?: Record<string, AirportName>): TicketLeg {
  const depCode = (leg.from ?? '').toUpperCase();
  const arrCode = (leg.to ?? '').toUpperCase();
  const depInfo = airportNames?.[depCode];
  const arrInfo = airportNames?.[arrCode];
  const code = airlineCode(leg.airline);
  return {
    direction: leg.direction,
    weekday: weekdayLabel(leg.departureAt),
    dateLabel: dateLabel(leg.departureAt),
    airlineCode: code,
    airline: airlineName(leg.airline),
    flightNumber: leg.flightNumber || code,
    aircraft: leg.aircraft || undefined,
    fareClass: leg.fareClass || leg.cabin || 'Phổ thông',
    baggageChecked: leg.baggageChecked || 'Theo hạng vé',
    baggageCarryOn: leg.baggageCarryOn || '7kg xách tay',
    stopsLabel: 'Bay thẳng',
    durationLabel: durationLabel(leg.departureAt, leg.arrivalAt),
    depTime: timeLabel(leg.departureAt),
    arrTime: timeLabel(leg.arrivalAt),
    depCity: depInfo?.city || depCode,
    arrCity: arrInfo?.city || arrCode,
    depCode,
    arrCode,
    depAirport: depInfo?.name || '',
    arrAirport: arrInfo?.name || '',
  };
}

export function bookingToTicketProps(
  src: TicketSource,
  airportNames?: Record<string, AirportName>,
): TicketProps {
  const legs = src.legs.map((leg) => toTicketLeg(leg, airportNames));
  const passengers: TicketPassenger[] = src.passengers.map((p, i) => ({
    index: i + 1,
    title: passengerTitle(p.type),
    fullName: `${p.lastName} ${p.firstName}`.trim().toUpperCase(),
    ticketNumber: p.ticketNumber || undefined,
  }));

  const props: TicketProps = {
    status: src.status,
    referenceCode: src.referenceCode,
    legs,
    passengers,
    price: {
      baseFare: src.baseFare ?? src.total,
      taxesAndFees: src.taxesAndFees ?? 0,
      baggageTotal: src.baggageTotal,
      total: src.total,
      segmentsLabel: legs.length > 1 ? `${legs.length} chặng` : undefined,
    },
    showPrice: src.showPrice,
  };

  if (src.status === 'quote') {
    props.quote = { validUntilLabel: deadlineLabel(src.quoteValidUntilIso) };
  }

  if (src.status === 'hold' && src.hold) {
    props.hold = {
      amountDue: src.hold.amountDue,
      bankCode: src.hold.bankCode || '',
      bankAccount: src.hold.bankAccount || '',
      bankAccountName: src.hold.bankAccountName || undefined,
      transferContent: src.hold.transferContent,
      qrImageUrl: src.hold.qrImageUrl || '',
      deadlineLabel: deadlineLabel(src.hold.deadlineIso),
      countdownLabel: src.hold.countdownLabel ?? '',
    };
  }

  if (src.status === 'paid' && src.paid) {
    const paidAt = parseIso(src.paid.paidAtIso);
    const paidAtLabel = paidAt
      ? (() => {
          const p = partsInTz(paidAt);
          return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
        })()
      : '';
    const issued = paidAt ? dateLabel(src.paid.paidAtIso) : '';
    props.paid = {
      totalPaid: src.paid.totalPaid,
      paidAtLabel,
      issuedDateLabel: issued,
    };
  }

  return props;
}
