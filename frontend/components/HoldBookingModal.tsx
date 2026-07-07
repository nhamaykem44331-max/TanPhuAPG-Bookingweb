"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Copy } from 'lucide-react';
import type {
  BookingAncillaryResponse,
  BookingAncillaryService,
  Cabin,
  FlightResult,
  HoldBookingPassenger,
  HoldBookingResponse,
  PassengerType,
  TripType,
} from '@/lib/types';
import { loadAncillaryResponse, peekAncillaryResponse } from '@/lib/ancillary-cache';
import { fmtVND, hhmm } from '@/lib/utils';
import { findAirportByCode, useAirports } from '@/lib/useAirports';
import AirlineLogo from '@/components/flight/AirlineLogo';
import FlightBadgePills from '@/components/flight/FlightBadgePills';
import { buildFlightConditionBadges } from '@/lib/flight-badges';
import SiteGlobeHeader from '@/components/SiteGlobeHeader';
import BookingStepper from '@/components/BookingStepper';

type UiPassenger = {
  id: string;
  type: PassengerType;
  title: string;
  fullName: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  loyaltyAirline: string;
  loyaltyNumber: string;
  passportNumber: string;
  passportNationality: string;
  passportIssuingCountry: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  listLuggage: NonNullable<HoldBookingPassenger['listLuggage']>;
};

type AncillaryRoute = BookingAncillaryResponse['routes'][number];
type AirportList = ReturnType<typeof useAirports>['airports'];
type HoldProgressStep = {
  from: number;
  to: number;
  durationMs: number;
  text: string;
};
type RefreshResult = { searchExpiresAt?: string } | void;

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

function routeCodeLabel(airports: AirportList, route?: string) {
  const [from = '', to = ''] = String(route || '').split('-');
  if (!from && !to) return 'ROUTE';
  if (!to) return airportCodeLabel(airports, from);
  return `${airportCodeLabel(airports, from)} → ${airportCodeLabel(airports, to)}`;
}

const HOLD_PROGRESS_STEPS: HoldProgressStep[] = [
  { from: 0, to: 15, durationMs: 1200, text: 'Đang kiểm tra dữ liệu hành khách...' },
  { from: 15, to: 45, durationMs: 2400, text: 'Đang gửi yêu cầu tạo PNR...' },
  { from: 45, to: 80, durationMs: 6000, text: 'Đang chờ Nam Thanh trả PNR...' },
  { from: 80, to: 95, durationMs: 5000, text: 'Đang đồng bộ giá chuẩn từ ticket-info-by-id...' },
];

function progressFromElapsed(elapsedMs: number) {
  let remaining = Math.max(0, elapsedMs);
  for (const step of HOLD_PROGRESS_STEPS) {
    if (remaining <= step.durationMs) {
      const ratio = step.durationMs > 0 ? remaining / step.durationMs : 1;
      return {
        percent: Math.round(step.from + (step.to - step.from) * Math.min(Math.max(ratio, 0), 1)),
        text: step.text,
      };
    }
    remaining -= step.durationMs;
  }
  const last = HOLD_PROGRESS_STEPS[HOLD_PROGRESS_STEPS.length - 1];
  return { percent: last.to, text: last.text };
}

function cleanKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function stableHash(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function shortPart(value: unknown, fallback: string, maxLength = 18) {
  return (cleanKey(String(value || '')) || fallback).slice(0, maxLength);
}

function makeIdempotencyKey(parts: unknown[]) {
  const raw = parts.map((part) => String(part || '')).join('|');
  const readable = [
    'HOLD',
    shortPart(parts[0], 'SEARCH', 14),
    shortPart(parts[1], 'OUT', 18),
    shortPart(parts[4], 'IN', 18),
    stableHash(raw),
  ].join('-');

  return readable.slice(0, 120);
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeMessageText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueMessageParts(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const text = normalizeMessageText(part);
    if (!text) return false;
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fieldLabel(path: string) {
  const labels: Record<string, string> = {
    'contact.fullName': 'Tên liên hệ',
    'contact.phone': 'Điện thoại liên hệ',
    'contact.email': 'Email liên hệ',
    passengers: 'Hành khách',
    outbound: 'Chuyến bay chiều đi',
    inbound: 'Chuyến bay chiều về',
    displayedNetPrice: 'Giá hiển thị',
    tripType: 'Kiểu hành trình',
  };

  return labels[path] || labels[path.split('.')[0]] || path;
}

function fieldErrorsText(value: unknown) {
  const source = recordOf(value);
  return Object.entries(source)
    .flatMap(([path, messages]) => {
      const list = Array.isArray(messages) ? messages : [messages];
      return list
        .map((message) => normalizeMessageText(message))
        .filter(Boolean)
        .map((message) => `${fieldLabel(path)}: ${message}`);
    })
    .join(' | ');
}

function holdErrorText(data: unknown) {
  const body = recordOf(data);
  const details = recordOf(body.details);
  const nested = recordOf(details.details);
  const nestedErrors = recordOf(nested.errors);
  const detailErrors = recordOf(details.errors);
  const bodyErrors = recordOf(body.errors);
  const errorCode = normalizeMessageText(body.error);
  const topMessage = errorCode === 'UPSTREAM_UNAVAILABLE'
    ? 'Chưa giữ được chỗ do hệ thống hãng/Nam Thanh phản hồi không ổn định'
    : errorCode === 'QUOTE_EXPIRED'
      ? 'Phiên giá đã hết hạn. Vui lòng làm mới hoặc chọn lại chuyến.'
      : errorCode === 'FLIGHT_NOT_AVAILABLE'
        ? 'Chuyến bay hoặc hạng giá này không còn khớp với dữ liệu mới. Vui lòng quay lại tìm kiếm để chọn chuyến khác.'
        : errorCode === 'SOLD_OUT'
          ? 'Chuyến bay hoặc hạng giá này đã hết chỗ.'
          : errorCode;
  const fieldErrors = fieldErrorsText(body.fieldErrors);
  const flatErrors = [nestedErrors, detailErrors, bodyErrors]
    .flatMap((source) => Object.entries(source))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .filter(Boolean);
  const parts = uniqueMessageParts([
    topMessage,
    normalizeMessageText(body.detail),
    nested.code ? `code ${String(nested.code)}` : '',
    normalizeMessageText(nested.message).toLowerCase() !== topMessage.toLowerCase()
      ? normalizeMessageText(nested.message)
      : '',
    details.path ? `path ${String(details.path)}` : '',
    fieldErrors,
    flatErrors.join(' | '),
  ]);
  return parts.join(' | ') || 'Lỗi giữ chỗ';
}

function compactUpper(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeDateInput(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return text;
}

function normalizedPhoneDigits(value: string) {
  const digits = value.replace(/\D+/g, '');
  if (digits.startsWith('84') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passengerLabel(type: PassengerType, index: number) {
  if (type === 'CHD') return `Trẻ em ${index}`;
  if (type === 'INF') return `Em bé ${index}`;
  return `Người lớn ${index}`;
}

function passengerKindLabel(type: PassengerType) {
  if (type === 'CHD') return 'Trẻ em (2–11 tuổi)';
  if (type === 'INF') return 'Em bé (< 2 tuổi)';
  return 'Người lớn';
}

function defaultTitle(type: PassengerType) {
  return type === 'ADT' ? 'MR' : 'MSTR';
}

function makePassengerSeed(type: PassengerType, index: number): UiPassenger {
  return {
    id: `${type}${index}`,
    type,
    title: defaultTitle(type),
    fullName: '',
    lastName: '',
    firstName: '',
    dateOfBirth: '',
    loyaltyAirline: '',
    loyaltyNumber: '',
    passportNumber: '',
    passportNationality: '',
    passportIssuingCountry: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    listLuggage: [],
  };
}

function buildPassengerSeeds(adults: number, children: number, infants: number) {
  const list: UiPassenger[] = [];
  for (let i = 1; i <= adults; i += 1) list.push(makePassengerSeed('ADT', i));
  for (let i = 1; i <= children; i += 1) list.push(makePassengerSeed('CHD', i));
  for (let i = 1; i <= infants; i += 1) list.push(makePassengerSeed('INF', i));
  return list;
}

function reconcilePassengers(prev: UiPassenger[], adults: number, children: number, infants: number) {
  const seeds = buildPassengerSeeds(adults, children, infants);
  const byId = new Map(prev.map((p) => [p.id, p]));
  return seeds.map((seed) => {
    const existing = byId.get(seed.id);
    return existing ? { ...seed, ...existing, id: seed.id, type: seed.type } : seed;
  });
}

// Strip Vietnamese accents → IATA-friendly uppercase, single space.
function sanitizeNamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function dedupeByKey(items: BookingAncillaryService[]) {
  const map = new Map<string, BookingAncillaryService>();
  for (const item of items) {
    const key = `${item.route}|${item.segmentId}|${item.key}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

const BAGGAGE_TYPE_PATTERN = /^(BAGGAGE|CHECKED[_-]?BAG|EXTRA[_-]?BAG|BAG)$/i;
const SEAT_TYPE_PATTERN = /^SEAT|^STSL/i;

function isBaggageService(service: BookingAncillaryService) {
  const type = String(service.serviceType || '').toUpperCase().trim();
  if (!type) return false;
  if (BAGGAGE_TYPE_PATTERN.test(type)) return true;
  const code = String(service.code || '').toUpperCase();
  if (/^BG\d*/i.test(code) || /\bBAGGAGE\b/i.test(service.description || '')) return true;
  return false;
}

function isSeatService(service: BookingAncillaryService) {
  const type = String(service.serviceType || '').toUpperCase().trim();
  if (SEAT_TYPE_PATTERN.test(type)) return true;
  return /^\d{1,2}[A-K]$/i.test(String(service.code || '').trim());
}

function servicesForPassenger(route: AncillaryRoute, passenger: UiPassenger) {
  const exact = route.services.filter((service) => service.paxId === passenger.id);
  const scoped = exact.length > 0
    ? exact
    : route.services.filter((service) => service.paxType === passenger.type);
  return dedupeByKey(scoped).sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
}

function baggageServicesForPassenger(route: AncillaryRoute, passenger: UiPassenger) {
  return servicesForPassenger(route, passenger).filter(isBaggageService);
}

export function _seatServicesForPassenger(route: AncillaryRoute, passenger: UiPassenger) {
  return servicesForPassenger(route, passenger).filter(isSeatService);
}

type PassengerFieldErrors = { lastName?: string; firstName?: string; dateOfBirth?: string };

// Số tháng tuổi tại một ngày mốc (ngày bay). Dùng cho ràng buộc tuổi INF/CHD/ADT.
function monthsOldAt(dobIso: string, atIso: string): number | null {
  const dob = new Date(dobIso);
  const at = new Date(atIso);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null;
  let months = (at.getFullYear() - dob.getFullYear()) * 12 + (at.getMonth() - dob.getMonth());
  if (at.getDate() < dob.getDate()) months -= 1;
  return months;
}

// Trả lỗi theo TỪNG trường cho 1 hành khách (không throw sớm) — để hiển thị inline.
// departIso = ngày khởi hành chặng đầu, dùng kiểm tra tuổi hợp lệ theo loại khách.
function passengerFieldErrors(passenger: UiPassenger, departIso: string): PassengerFieldErrors {
  const errs: PassengerFieldErrors = {};
  const last = compactUpper(passenger.lastName);
  const first = compactUpper(passenger.firstName);
  if (!last) errs.lastName = 'Vui lòng nhập Họ.';
  if (!first) errs.firstName = 'Vui lòng nhập Đệm và tên.';
  if (last && first && `${last} ${first}`.trim().split(/\s+/).filter(Boolean).length < 2) {
    errs.firstName = 'Họ tên tối thiểu 2 từ, đúng như trên CCCD/Hộ chiếu.';
  }

  if (passenger.type !== 'ADT' && !passenger.dateOfBirth) {
    errs.dateOfBirth = 'Bắt buộc có ngày sinh với trẻ em / em bé.';
  } else if (passenger.dateOfBirth) {
    const dob = new Date(passenger.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errs.dateOfBirth = 'Ngày sinh không hợp lệ.';
    } else if (dob.getTime() > Date.now()) {
      errs.dateOfBirth = 'Ngày sinh không thể ở tương lai.';
    } else if (departIso) {
      const months = monthsOldAt(passenger.dateOfBirth, departIso);
      if (months != null) {
        if (passenger.type === 'INF' && months >= 24) {
          errs.dateOfBirth = 'Em bé phải dưới 2 tuổi tại ngày bay. Nếu bé từ 2 tuổi, hãy chọn loại Trẻ em.';
        } else if (passenger.type === 'CHD' && months < 24) {
          errs.dateOfBirth = 'Trẻ em phải từ 2 tuổi tại ngày bay. Dưới 2 tuổi hãy chọn loại Em bé.';
        } else if (passenger.type === 'CHD' && months >= 144) {
          errs.dateOfBirth = 'Trẻ em phải dưới 12 tuổi tại ngày bay. Từ 12 tuổi tính là Người lớn.';
        } else if (passenger.type === 'ADT' && months < 144) {
          errs.dateOfBirth = 'Người lớn phải từ 12 tuổi tại ngày bay.';
        }
      }
    }
  }
  return errs;
}

function buildPassengerPayload(passenger: UiPassenger): HoldBookingPassenger {
  const lastName = compactUpper(passenger.lastName);
  const firstName = compactUpper(passenger.firstName);
  const fullName = compactUpper([lastName, firstName].filter(Boolean).join(' '));
  const dateOfBirth = normalizeDateInput(passenger.dateOfBirth);
  const passport = {
    number: compactUpper(passenger.passportNumber),
    nationality: compactUpper(passenger.passportNationality),
    issuingCountry: compactUpper(passenger.passportIssuingCountry),
    issueDate: normalizeDateInput(passenger.passportIssueDate),
    expiryDate: normalizeDateInput(passenger.passportExpiryDate),
  };
  const hasPassport = Object.values(passport).some(Boolean);
  const selectedLuggage = passenger.listLuggage.length > 0 ? passenger.listLuggage : undefined;

  return {
    id: passenger.id,
    type: passenger.type,
    title: compactUpper(passenger.title) || defaultTitle(passenger.type),
    fullName,
    lastName,
    firstName,
    name: fullName,
    dateOfBirth: dateOfBirth || undefined,
    birthday: dateOfBirth || undefined,
    loyaltyAirline: compactUpper(passenger.loyaltyAirline) || undefined,
    loyaltyNumber: compactUpper(passenger.loyaltyNumber) || undefined,
    passport: hasPassport ? passport : undefined,
    listLuggage: selectedLuggage,
    ancillaryServices: selectedLuggage,
  };
}

function titleOptionsFor(type: PassengerType) {
  if (type === 'ADT') return ['MR', 'MRS', 'MS'] as const;
  return ['MSTR', 'MISS'] as const;
}

function flightDurationLabel(flight: FlightResult) {
  const dep = new Date(flight.departure.time).getTime();
  const arr = new Date(flight.arrival.time).getTime();
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return '';
  const mins = Math.round((arr - dep) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function dateLabel(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const SESSION_DURATION_SEC = 10 * 60;
const SESSION_EXPIRY_BUFFER_SEC = 30;

// Absolute ms timestamp at which the hold session should be treated as expired.
function sessionDeadlineFromExpiry(expiresAt?: string): number {
  if (expiresAt) {
    const ms = Date.parse(expiresAt);
    if (Number.isFinite(ms)) return ms - SESSION_EXPIRY_BUFFER_SEC * 1000;
  }
  return Date.now() + SESSION_DURATION_SEC * 1000;
}

// Self-contained 1s countdown so only this small label re-renders each tick —
// not the whole ~1800-line booking form. Reads an absolute deadline timestamp.
function SessionCountdown({ deadlineMs }: { deadlineMs: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
  const urgent = remaining > 0 && remaining < 5 * 60;
  const label = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return <b className={`apg-tabular ${urgent ? 'text-amber-700' : 'text-slate-700'}`}>{label}</b>;
}

export default function HoldBookingModal({
  flight,
  inbound,
  tripType = 'oneway',
  search,
  adults = 1,
  children = 0,
  infants = 0,
  cabin = 'economy',
  open,
  onClose,
  selectionExpiresAt,
  onRefresh,
  asPage = false,
  onHeld,
  onExportQuote,
  quoteCode: quoteCodeProp,
}: {
  flight: FlightResult | null;
  inbound?: FlightResult | null;
  tripType?: TripType;
  search?: {
    from: string;
    to: string;
    date: string;
    returnDate?: string;
  };
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: Cabin;
  open: boolean;
  onClose: () => void;
  selectionExpiresAt?: string;
  onRefresh?: () => RefreshResult | Promise<RefreshResult>;
  asPage?: boolean;
  onHeld?: (bookingId: string) => void;
  onExportQuote?: () => void;
  quoteCode?: string;
}) {
  const { airports } = useAirports();
  const [passengers, setPassengers] = useState<UiPassenger[]>(() => buildPassengerSeeds(adults, children, infants));
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const createRealHold = true;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passengerErrors, setPassengerErrors] = useState<Record<string, PassengerFieldErrors>>({});
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [vatWanted, setVatWanted] = useState(false);
  const [vat, setVat] = useState({ companyName: '', taxId: '', address: '', email: '' });
  const [partialHold, setPartialHold] = useState<{
    orphanPnrs: Array<{ airline?: string; pnr: string; status?: string; from?: string; to?: string }>;
    cancelStatus: 'AUTO_CANCELLED' | 'PARTIAL_CANCELLED' | 'NEEDS_MANUAL_CANCEL';
    detail: string;
  } | null>(null);
  const [holdTimedOut, setHoldTimedOut] = useState(false);
  const [result, setResult] = useState<HoldBookingResponse | null>(null);
  const [holdProgressPct, setHoldProgressPct] = useState(0);
  const [holdProgressText, setHoldProgressText] = useState('');
  const [holdProgressElapsedMs, setHoldProgressElapsedMs] = useState(0);
  const [ancillaryLoading, setAncillaryLoading] = useState(false);
  const [ancillaryError, setAncillaryError] = useState('');
  const [ancillaryWarning, setAncillaryWarning] = useState('');
  const [ancillaryRoutes, setAncillaryRoutes] = useState<AncillaryRoute[]>([]);
  const [ancillaryAttempt, setAncillaryAttempt] = useState(0);
  const [skipBaggage, setSkipBaggage] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [sessionDeadlineMs, setSessionDeadlineMs] = useState(() => sessionDeadlineFromExpiry(selectionExpiresAt));
  const [sessionExpired, setSessionExpired] = useState(() => Date.now() >= sessionDeadlineFromExpiry(selectionExpiresAt));
  const [refreshing, setRefreshing] = useState(false);
  const refreshTriggeredRef = useRef(false);
  const resultRef = useRef<HoldBookingResponse | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const isRoundtrip = tripType === 'roundtrip' && !!inbound;
  const splitRoundtrip = isRoundtrip &&
    String(flight?.airlineCode || '').toUpperCase() !== String(inbound?.airlineCode || '').toUpperCase();
  const holdFlights = useMemo(() => (
    flight ? [flight, ...(isRoundtrip && inbound ? [inbound] : [])] : []
  ), [flight, inbound, isRoundtrip]);
  // Tổng theo SỐ KHÁCH: mỗi chặng nhân net từng loại khách (perPax) với số khách loại đó.
  // Thiếu perPax (search cũ) → coi mọi khách như người lớn để không hiển thị thiếu.
  const paxCounts = passengers.reduce(
    (acc, p) => {
      acc[p.type] += 1;
      return acc;
    },
    { ADT: 0, CHD: 0, INF: 0 } as Record<PassengerType, number>,
  );
  const partyFareForFlight = (item: FlightResult) => {
    const perPax = item.fareBreakdown?.perPax;
    const adt = perPax?.adt ?? item.fareBreakdown?.totalAmount ?? item.price.amount ?? 0;
    const chd = perPax?.chd ?? adt;
    const inf = perPax?.inf ?? 0;
    return adt * paxCounts.ADT + chd * paxCounts.CHD + inf * paxCounts.INF;
  };
  const fareTotal = holdFlights.reduce((sum, item) => sum + partyFareForFlight(item), 0);
  const baggageTotal = passengers.reduce(
    (sum, p) => sum + p.listLuggage.reduce((s, l) => s + Number(l.price || 0), 0),
    0
  );
  const estimatedTotal = fareTotal + baggageTotal;
  const pricing = result?.pricing;
  const pricingByPnr = pricing?.byPnr || [];
  const unresolvedPricingPnrs = pricing?.unresolvedPnrs || [];
  const hasVerifiedPricing = pricing?.verified === true && typeof result?.totalAmount === 'number';
  const shouldShowPricingPending = !!result && !result.dryRun && !hasVerifiedPricing;
  const showHoldProgress = createRealHold && (loading || (!!result && result.dryRun === false));
  const showHoldSlowHint = createRealHold && loading && holdProgressElapsedMs > 12_000;

  const idempotencyKey = useMemo(() => {
    if (!flight) return '';
    const passengerKey = passengers
      .map((p) => `${p.id}-${compactUpper(`${p.lastName} ${p.firstName}`)}-${p.dateOfBirth}`)
      .join('-');
    return makeIdempotencyKey([
      flight.searchId || 'search',
      flight.id,
      flight.fareId || 'fare',
      inbound?.searchId || '',
      inbound?.id || '',
      inbound?.fareId || '',
      passengerKey,
    ]);
  }, [flight, inbound, passengers]);

  const ancillaryPayload = useMemo(() => {
    if (!flight) return null;
    return {
      flight,
      outbound: flight,
      inbound: isRoundtrip ? inbound : null,
      tripType: isRoundtrip ? 'roundtrip' : 'oneway',
      search,
      adults,
      children,
      infants,
      cabin,
    } as const;
  }, [flight, inbound, isRoundtrip, search, adults, children, infants, cabin]);

  useEffect(() => {
    if (!open) return;
    setPassengers((prev) => reconcilePassengers(prev, adults, children, infants));
    setError('');
    setHoldTimedOut(false);
    setResult(null);
    setHoldProgressPct(0);
    setHoldProgressText('');
    setHoldProgressElapsedMs(0);
    const dl = sessionDeadlineFromExpiry(selectionExpiresAt);
    setSessionDeadlineMs(dl);
    setSessionExpired(Date.now() >= dl);
    setRefreshing(false);
    refreshTriggeredRef.current = false;
  }, [open, adults, children, infants]);

  useEffect(() => {
    if (!open) return;
    const dl = sessionDeadlineFromExpiry(selectionExpiresAt);
    setSessionDeadlineMs(dl);
    setSessionExpired(Date.now() >= dl);
    setRefreshing(false);
    refreshTriggeredRef.current = false;
  }, [open, selectionExpiresAt]);

  // Hold thành công → cuộn lên đầu để khách thấy ngay màn xác nhận (body form được thay bằng success view).
  useEffect(() => {
    if (!result) return;
    try {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { /* noop */ }
  }, [result]);

  useEffect(() => {
    if (!open || result || refreshing || sessionExpired) return;
    const ms = sessionDeadlineMs - Date.now();
    if (ms <= 0) { setSessionExpired(true); return; }
    const id = window.setTimeout(() => setSessionExpired(true), ms);
    return () => window.clearTimeout(id);
  }, [open, result, refreshing, sessionExpired, sessionDeadlineMs]);

  // Auto-refresh when the upstream quote token expires.
  useEffect(() => {
    if (!open || result) {
      refreshTriggeredRef.current = false;
      return;
    }
    if (!sessionExpired || refreshTriggeredRef.current) return;
    refreshTriggeredRef.current = true;
    setRefreshing(true);
    (async () => {
      let refreshed = false;
      try {
        if (onRefresh) {
          const refreshResult = await onRefresh();
          refreshed = true;
          const nextExpiresAt = refreshResult && typeof refreshResult === 'object'
            ? refreshResult.searchExpiresAt
            : undefined;
          const nextDeadline = sessionDeadlineFromExpiry(nextExpiresAt);
          setSessionDeadlineMs(nextDeadline);
          setSessionExpired(Date.now() >= nextDeadline);
        }
        // No onRefresh: never hard-reload (it would wipe the form and can loop forever
        // on a stale TTL). Leave the timer at 0 so the "Phiên đã hết hạn" UI takes over.
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRefreshing(false);
        if (refreshed) {
          refreshTriggeredRef.current = false;
        }
      }
    })();
  }, [open, result, sessionExpired, onRefresh]);

  useEffect(() => {
    resultRef.current = result;
    setCopiedResult(false);
  }, [result]);

  useEffect(() => {
    if (!loading || !createRealHold || result) return;
    const startedAt = Date.now();
    let timer = 0;

    const tick = () => {
      if (resultRef.current) {
        if (timer) window.clearInterval(timer);
        return;
      }
      const elapsedMs = Date.now() - startedAt;
      const snapshot = progressFromElapsed(elapsedMs);
      setHoldProgressElapsedMs(elapsedMs);
      setHoldProgressPct(snapshot.percent);
      setHoldProgressText(snapshot.text);
    };

    tick();
    timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [loading, createRealHold, result]);

  useEffect(() => {
    if (!open || !ancillaryPayload) return;
    if (skipBaggage) return;
    let ignore = false;

    const fetchAncillaries = async () => {
      const cached = peekAncillaryResponse(ancillaryPayload);
      if (cached) {
        if (!ignore) {
          setAncillaryRoutes(Array.isArray(cached.routes) ? cached.routes : []);
          setAncillaryWarning(cached.message || '');
          setAncillaryError('');
          setAncillaryLoading(false);
        }
        return;
      }

      setAncillaryLoading(true);
      setAncillaryError('');
      setAncillaryWarning('');
      setAncillaryRoutes([]);
      try {
        const data = await loadAncillaryResponse(ancillaryPayload);
        if (!ignore) {
          setAncillaryRoutes(Array.isArray(data.routes) ? data.routes : []);
          setAncillaryWarning(data.message || '');
        }
      } catch (err: unknown) {
        if (!ignore) {
          setAncillaryRoutes([]);
          setAncillaryWarning('');
          setAncillaryError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!ignore) setAncillaryLoading(false);
      }
    };

    fetchAncillaries();
    return () => { ignore = true; };
  }, [
    open,
    ancillaryPayload,
    ancillaryAttempt,
    skipBaggage,
  ]);

  useEffect(() => {
    if (open) return;
    setSkipBaggage(false);
    setAncillaryAttempt(0);
    setPartialHold(null);
    setExpandedDetails({});
  }, [open]);

  if (!open || !flight) return null;

  const updatePassenger = (index: number, patch: Partial<UiPassenger>) => {
    setPassengers((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      next.fullName = compactUpper([next.lastName, next.firstName].filter(Boolean).join(' '));
      return next;
    }));
  };

  const updatePassengerLuggage = (
    index: number,
    routeCode: string,
    segmentId: number,
    airlineCode: string | undefined,
    selectedKey: string,
    available: BookingAncillaryService[]
  ) => {
    const normalizedAirline = compactUpper(airlineCode || '');
    setPassengers((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const kept = item.listLuggage.filter(
        (luggage) => !(
          luggage.route === routeCode &&
          Number(luggage.segmentId || 0) === segmentId &&
          compactUpper(luggage.airline || '') === normalizedAirline
        )
      );
      if (!selectedKey) return { ...item, listLuggage: kept };
      const picked = available.find((option) => option.key === selectedKey);
      if (!picked) return { ...item, listLuggage: kept };
      return {
        ...item,
        listLuggage: [
          ...kept,
          {
            route: routeCode,
            segmentId,
            airline: picked.airline,
            serviceType: picked.serviceType,
            code: picked.code,
            key: picked.key,
            description: picked.description,
            unit: picked.unit,
            price: picked.price,
          },
        ],
      };
    }));
  };

  async function submitHold() {
    if (!flight) return;
    let timeoutId: number | null = null;
    setLoading(true);
    setError('');
    setPartialHold(null);
    setHoldTimedOut(false);
    setResult(null);
    if (createRealHold) {
      setHoldProgressPct(2);
      setHoldProgressText('Đang kiểm tra dữ liệu hành khách...');
      setHoldProgressElapsedMs(0);
    } else {
      setHoldProgressPct(0);
      setHoldProgressText('');
      setHoldProgressElapsedMs(0);
    }
    try {
      // Validate TẤT CẢ hành khách một lượt (không throw ở lỗi đầu tiên) → tô đỏ inline.
      const departIso = holdFlights[0]?.departure?.time || search?.date || '';
      const nextErrors: Record<string, PassengerFieldErrors> = {};
      passengers.forEach((passenger) => {
        const fe = passengerFieldErrors(passenger, departIso);
        if (Object.keys(fe).length > 0) nextErrors[passenger.id] = fe;
      });
      setPassengerErrors(nextErrors);
      const errorCount = Object.keys(nextErrors).length;
      if (errorCount > 0) {
        setError(`Vui lòng kiểm tra lại thông tin ${errorCount} hành khách được tô đỏ bên dưới.`);
        setLoading(false);
        setHoldProgressPct(0);
        setHoldProgressText('');
        // Cuộn + focus tới ô lỗi đầu tiên (khách mobile bấm nút cuối trang thấy ngay chỗ sai).
        window.setTimeout(() => {
          const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
          if (first) {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            first.focus({ preventScroll: true });
          }
        }, 50);
        return;
      }

      if (!agreedTerms) {
        setError('Vui lòng tích “Tôi đã đọc và đồng ý điều khoản” trước khi giữ chỗ.');
        setLoading(false);
        setHoldProgressPct(0);
        setHoldProgressText('');
        return;
      }

      const payloadPassengers = passengers.map((passenger) => buildPassengerPayload(passenger));
      const contactName = payloadPassengers[0]?.fullName || '';
      const phoneDigits = normalizedPhoneDigits(phone);
      const trimmedEmail = email.trim();

      if (!phoneDigits || phoneDigits.length < 9 || phoneDigits.length > 15) {
        throw new Error('Điện thoại liên hệ không hợp lệ. Vui lòng nhập 9-15 chữ số.');
      }

      if (!isValidEmail(trimmedEmail)) {
        throw new Error('Email liên hệ không hợp lệ. Vui lòng nhập email để nhận xác nhận giữ chỗ.');
      }

      if (createRealHold) {
        setHoldProgressPct((prev) => Math.max(prev, 18));
        setHoldProgressText('Đang gửi yêu cầu tạo PNR...');
      }
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 180000);
      const res = await fetch('/api/booking/hold', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          airline: flight.airlineCode,
          route: `${flight.departure.airport}-${flight.arrival.airport}`,
          fareClass: flight.namthanh?.class || flight.namthanh?.fareBasis,
          displayedNetPrice: fareTotal, // flight sell total only (baggage excluded — compared against fresh sell server-side)
          flight,
          outbound: flight,
          inbound: isRoundtrip ? inbound : undefined,
          tripType: isRoundtrip ? 'roundtrip' : 'oneway',
          search,
          adults,
          children,
          infants,
          cabin,
          passengers: payloadPassengers,
          contact: {
            fullName: contactName,
            phone: phoneDigits,
            email: trimmedEmail,
          },
          vatInvoice: vatWanted && (vat.companyName.trim() || vat.taxId.trim())
            ? {
                companyName: vat.companyName.trim(),
                taxId: vat.taxId.trim(),
                address: vat.address.trim(),
                email: vat.email.trim() || trimmedEmail,
              }
            : null,
          dryRun: false,
          idempotencyKey,
        }),
      });
      if (createRealHold) {
        setHoldProgressPct((prev) => Math.max(prev, 85));
        setHoldProgressText('Đang đồng bộ giá chuẩn từ ticket-info-by-id...');
      }
      const data = await res.json();
      if (!res.ok || data.success === false) {
        const errorBody = recordOf(data);
        if (errorBody.error === 'PARTIAL_HOLD' && Array.isArray(errorBody.orphanPnrs)) {
          setPartialHold({
            orphanPnrs: errorBody.orphanPnrs as Array<{ airline?: string; pnr: string; status?: string; from?: string; to?: string }>,
            cancelStatus: (errorBody.orphanCancelStatus as 'AUTO_CANCELLED' | 'PARTIAL_CANCELLED' | 'NEEDS_MANUAL_CANCEL') || 'NEEDS_MANUAL_CANCEL',
            detail: String(errorBody.detail || ''),
          });
          setError(holdErrorText(data));
          return;
        }
        throw new Error(holdErrorText(data));
      }
      setResult(data);
      if (createRealHold) {
        setHoldProgressPct(100);
        setHoldProgressText('Hoàn tất tạo PNR thật.');
      }
      // Giá hãng thay đổi đáng kể giữa lúc xem và lúc giữ chỗ → KHÔNG tự sang thanh toán.
      // Hiện xác nhận để khách duyệt giá mới (PNR đã giữ; khách quyết định trả hay để sau).
      if (data?.priceDelta) return;
      // Trang đặt vé (asPage): hold xong → chuyển sang thanh toán SePay
      if (onHeld && data?.bookingId) onHeld(String(data.bookingId));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setHoldTimedOut(true);
        setError('Hệ thống phản hồi quá chậm (>3 phút). Mã đặt chỗ có thể đã tạo — vui lòng kiểm tra ở mục Chuyến bay của tôi (mã đơn + số điện thoại) hoặc gọi hotline 0918.752.686.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const pnrRows = (() => {
    if (!result) return [];
    const pnrs = result.pnrs || [];
    const pricingItems = pricingByPnr;
    const singlePnrRoundtrip = isRoundtrip && pnrs.length === 1 && holdFlights.length > 1;
    const pricingByCode = new Map(
      pricingItems.map((item) => [String(item.pnr || '').trim().toUpperCase(), item])
    );
    const usedPricingKeys = new Set<string>();
    const rows = pnrs.map((pnr, index) => {
      const pnrCode = String(pnr.pnr || `PNR-${index + 1}`).trim();
      const pricingItem = pricingByCode.get(pnrCode.toUpperCase()) || pricingItems[index];
      if (pricingItem?.pnr) usedPricingKeys.add(String(pricingItem.pnr).trim().toUpperCase());
      const fallbackFlight = holdFlights[index] || holdFlights[0] || null;
      const rowFlights = singlePnrRoundtrip ? holdFlights : (fallbackFlight ? [fallbackFlight] : []);
      const routeLabel = singlePnrRoundtrip
        ? rowFlights
            .map((item) => `${airportEndpointLabel(airports, item.departure)} → ${airportEndpointLabel(airports, item.arrival)}`)
            .join(' / ')
        : pnr.from && pnr.to
        ? `${airportCodeLabel(airports, pnr.from)} → ${airportCodeLabel(airports, pnr.to)}`
        : fallbackFlight
          ? `${airportEndpointLabel(airports, fallbackFlight.departure)} → ${airportEndpointLabel(airports, fallbackFlight.arrival)}`
          : '';
      const flightSummary = rowFlights
        .map((item) => `${item.airlineCode} ${item.flightNumber} · ${hhmm(item.departure.time)} → ${hhmm(item.arrival.time)}`)
        .join(' / ');
      const roundtripPnrTotal = typeof result.totalAmount === 'number'
        ? result.totalAmount
        : typeof pricing?.totalAmount === 'number'
          ? pricing.totalAmount
          : estimatedTotal;
      return {
        key: `${pnrCode}-${index}`,
        pnr: pnrCode || '-',
        airline: pnr.airline || fallbackFlight?.airlineCode || '',
        status: pnr.status || (result.success ? 'SUCCESS' : ''),
        routeLabel,
        flightSummary,
        legLabel: singlePnrRoundtrip ? 'Khứ hồi' : isRoundtrip ? (index === 0 ? 'Chiều đi' : 'Chiều về') : 'Chuyến bay',
        totalAmount: singlePnrRoundtrip
          ? roundtripPnrTotal
          : typeof pricingItem?.totalAmount === 'number'
            ? pricingItem.totalAmount
            : undefined,
        timelimit: pricingItem?.timelimit || pnr.timelimit || result.holdExpiresAt || '',
        message: pnr.message && pnr.message !== pnr.pnr ? pnr.message : '',
      };
    });

    pricingItems.forEach((item, index) => {
      const pnrCode = String(item.pnr || '').trim();
      const key = pnrCode.toUpperCase();
      if (!pnrCode || usedPricingKeys.has(key)) return;
      const fallbackFlight = holdFlights[pnrs.length + index] || holdFlights[index] || holdFlights[0] || null;
      rows.push({
        key: `${pnrCode}-pricing-${index}`,
        pnr: pnrCode,
        airline: fallbackFlight?.airlineCode || '',
        status: result.success ? 'SUCCESS' : '',
        routeLabel: fallbackFlight
          ? `${airportEndpointLabel(airports, fallbackFlight.departure)} → ${airportEndpointLabel(airports, fallbackFlight.arrival)}`
          : '',
        flightSummary: fallbackFlight
          ? `${fallbackFlight.airlineCode} ${fallbackFlight.flightNumber} · ${hhmm(fallbackFlight.departure.time)} → ${hhmm(fallbackFlight.arrival.time)}`
          : '',
        legLabel: isRoundtrip ? (rows.length === 0 ? 'Chiều đi' : 'Chiều về') : 'Chuyến bay',
        totalAmount: typeof item.totalAmount === 'number' ? item.totalAmount : undefined,
        timelimit: item.timelimit || result.holdExpiresAt || '',
        message: '',
      });
    });

    return rows;
  })();

  // Backend đã cộng baggage vào saleAmount → result.totalAmount đã là tổng thanh toán cuối.
  // Không cộng baggageTotal lần nữa (tránh double-count). baggageTotal chỉ dùng để hiển thị breakdown.
  const paymentTotal = typeof result?.totalAmount === 'number' ? result.totalAmount : null;

  const holdResultCopyText = result ? [
    'Giữ chỗ OK',
    result.orderCode ? `Mã đơn hàng: ${result.orderCode}` : '',
    result.sessionID ? `Phiên: ${result.sessionID}` : '',
    result.passenger ? `Khách: ${result.passenger}` : '',
    baggageTotal > 0 ? `Phí hành lý ký gửi (đã cộng): ${fmtVND(baggageTotal)}` : '',
    paymentTotal !== null ? `Tổng thanh toán: ${fmtVND(paymentTotal)}` : '',
    pricing?.source ? `Nguồn giá: ${pricing.source}` : '',
    pnrRows.length ? '' : 'PNR: Chưa có dữ liệu PNR',
    ...pnrRows.map((row) => [
      `${row.legLabel}: PNR ${row.pnr}`,
      row.airline ? `Hãng: ${row.airline}` : '',
      row.status ? `Trạng thái: ${row.status}` : '',
      row.routeLabel ? `Chặng: ${row.routeLabel}` : '',
      row.flightSummary ? `Chuyến: ${row.flightSummary}` : '',
      typeof row.totalAmount === 'number' ? `Giá PNR: ${fmtVND(row.totalAmount)}` : 'Giá PNR: Đang đồng bộ',
      row.timelimit ? `Thời hạn giữ chỗ: ${row.timelimit}` : '',
      row.message ? `Ghi chú: ${row.message}` : '',
    ].filter(Boolean).join('\n')),
  ].filter(Boolean).join('\n\n') : '';

  async function copyHoldResultText() {
    if (!holdResultCopyText) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(holdResultCopyText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = holdResultCopyText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedResult(true);
      window.setTimeout(() => setCopiedResult(false), 1400);
    } catch {
      setCopiedResult(false);
    }
  }


  /* ───────── Visual blocks ───────── */

  const stepperBlock = <BookingStepper stage={result ? 'pay' : 'passenger'} />;

  const tripBanner = splitRoundtrip ? (
    <div className="flex gap-2 rounded-[var(--apg-radius-md)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      <p className="text-[11px] leading-relaxed">
        Hành trình ghép 2 hãng (<b>{flight?.airlineCode} + {inbound?.airlineCode}</b>) sẽ phát hành <b>2 PNR riêng</b>. Vé mỗi chiều xuất độc lập, đổi/hoàn theo điều kiện riêng từng hãng.
      </p>
    </div>
  ) : null;

  const quoteCode = (() => {
    const seed = `${flight?.flightNumber || ''}${inbound?.flightNumber || ''}${search?.date || ''}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return `APG-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
  })();
  const fromCity = findAirportByCode(airports, holdFlights[0]?.departure.airport)?.city || holdFlights[0]?.departure.airport || '';
  const toCity = findAirportByCode(airports, holdFlights[0]?.arrival.airport)?.city || holdFlights[0]?.arrival.airport || '';
  const paxCount = adults + children + infants;
  const cabinLabel = ({ ECONOMY: 'Phổ thông', PREMIUM_ECONOMY: 'Phổ thông đặc biệt', BUSINESS: 'Thương gia', FIRST: 'Hạng nhất' } as Record<string, string>)[String(cabin).toUpperCase()] || 'Phổ thông';
  const routeChip = `${isRoundtrip ? 'Khứ hồi' : 'Một chiều'} · ${cabinLabel} · ${paxCount} khách`;

  const itineraryBlock = (
    <div className="space-y-2.5">
      <div className="pb-0.5">
        <h3 className="text-[19px] font-bold leading-tight text-[var(--apg-aviation-navy)]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>
          {fromCity} <span className="text-[#C7A24C]">⇄</span> {toCity}
        </h3>
        <span className="mt-1.5 inline-block rounded-full border border-[var(--apg-border-default)] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#586675]">{routeChip}</span>
      </div>
      {holdFlights.map((item, index) => {
        const flightDate = (search ? (index === 0 ? search.date : search.returnDate) : '') || (item.departure.time?.slice(0, 10) ?? '');
        const legLabel = isRoundtrip ? (index === 0 ? 'CHIỀU ĐI' : 'CHIỀU VỀ') : 'CHUYẾN BAY';
        const headerBg = isRoundtrip && index === 1
          ? 'linear-gradient(135deg,#5A2330,#7A3A48 58%,#1A4B74)'
          : 'linear-gradient(135deg,#0E2A47,#143A5C)';
        return (
          <div key={`${item.id}-${index}`} className="overflow-hidden rounded-[14px] border border-[var(--apg-border-default)] bg-white">
            <div className="flex items-center justify-between px-3.5 py-2.5 text-white" style={{ background: headerBg }}>
              <span className="text-[11px] font-bold tracking-[0.14em]">✈ {legLabel}</span>
              <span className="rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">{dateLabel(flightDate)}</span>
            </div>
            <div className="flex items-start gap-3 px-3.5 py-3">
              <AirlineLogo code={item.airlineCode} airline={item.airline} logo={item.airlineLogo} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-extrabold leading-tight tracking-[-0.01em] text-[#16212B]">
                  {hhmm(item.departure.time)} <span className="text-[#9aa5b1]">→</span> {hhmm(item.arrival.time)}
                  <span className="ml-1.5 text-[11px] font-medium text-[#93A0AC]">{flightDurationLabel(item)}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--apg-aviation-navy)]">{item.airline} · {item.flightNumber} · {item.stops === 0 ? 'Bay thẳng' : `${item.stops} điểm dừng`}</div>
                <div className="mt-px text-[11.5px] text-[#586675]">{item.departure.airport} → {item.arrival.airport}</div>
              </div>
            </div>
            <div className="border-t border-[var(--apg-border-default)] bg-[#FAFBFC] px-3.5 py-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#93A0AC]">Điều kiện vé</div>
              <FlightBadgePills badges={buildFlightConditionBadges(item)} />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#7a8794]">
                Đổi / hoàn / no-show theo điều kiện của <b className="text-[#586675]">{item.airline}</b>.{' '}
                <a href="/hoan-doi-huy-ve" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--apg-aviation-navy)] underline">Xem chính sách</a>
              </p>
            </div>
          </div>
        );
      })}

      <div className="rounded-[var(--apg-radius-md)] border border-[var(--apg-aviation-navy-soft)] bg-[var(--apg-bg-surface-soft)] px-3 py-3 text-xs">
        <div className="flex justify-between text-slate-600"><span>Vé máy bay ({passengers.length} khách{holdFlights.length > 1 ? ` · ${holdFlights.length} chặng` : ''})</span><span className="apg-tabular">{fmtVND(fareTotal)}</span></div>
        {baggageTotal > 0 && (
          <div className="mt-1 flex justify-between text-slate-600"><span>Hành lý ký gửi</span><span className="apg-tabular">{fmtVND(baggageTotal)}</span></div>
        )}
        <div className="my-1.5 border-t border-[var(--apg-aviation-navy-soft)]" />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--apg-aviation-navy)]">Tổng cộng (ước tính)</span>
          <span className="apg-tabular text-[15px] font-bold text-[var(--apg-aviation-navy)]">{fmtVND(estimatedTotal)}</span>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">Giá ước tính theo fare snapshot. Giá chuẩn sẽ đồng bộ theo PNR sau khi giữ chỗ.</p>
      </div>
    </div>
  );

  const progressBlock = showHoldProgress ? (
    <div className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-3 py-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--apg-aviation-navy)]">
        <span>{holdProgressText || 'Đang xử lý tạo PNR...'}</span>
        <span className="apg-tabular">{Math.max(0, Math.min(100, Math.round(holdProgressPct)))}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--apg-aviation-navy-soft)]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ background: 'linear-gradient(90deg, var(--apg-brand-gold), color-mix(in srgb, var(--apg-route-inbound) 55%, var(--apg-aviation-navy)))', width: `${Math.max(0, Math.min(100, holdProgressPct))}%` }}
        />
      </div>
      {showHoldSlowHint && (
        <div className="mt-2 text-[11px] text-[var(--apg-aviation-navy)]">Hệ thống đang xử lý trên Tan Phu APG, vui lòng chờ…</div>
      )}
    </div>
  ) : null;

  const partialHoldBlock = partialHold ? (
    <div className="rounded-[var(--apg-radius-md)] border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs">
      <div className="mb-2 flex items-start gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600">
          <path d="M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z" />
        </svg>
        <div className="flex-1">
          <div className="font-bold text-amber-900">⚠ Giữ chỗ một phần — Cần xử lý PNR mồ côi</div>
          <div className="mt-1 leading-relaxed text-amber-800">
            Chiều đi đã tạo PNR thành công nhưng <strong>chiều về bị lỗi</strong> ({partialHold.detail}).
          </div>
        </div>
      </div>

      <div className="mb-2 rounded-md border border-amber-200 bg-white/70 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Trạng thái xử lý tự động</div>
        <div className="mt-1 text-[12px] text-amber-900">
          {partialHold.cancelStatus === 'AUTO_CANCELLED' && (
            <span className="font-semibold text-brand-700">✓ Đã tự động huỷ thành công các PNR mồ côi. Anh/chị có thể thử lại.</span>
          )}
          {partialHold.cancelStatus === 'PARTIAL_CANCELLED' && (
            <span className="font-semibold text-orange-700">⚠ Đã huỷ được một phần. Vui lòng kiểm tra danh sách bên dưới và liên hệ CSKH cho PNR còn lại.</span>
          )}
          {partialHold.cancelStatus === 'NEEDS_MANUAL_CANCEL' && (
            <span className="font-semibold text-red-700">✗ Auto-cancel không khả dụng. Vui lòng liên hệ CSKH (Hotline 0918.752.686) để huỷ thủ công các PNR dưới đây.</span>
          )}
        </div>
      </div>

      {partialHold.orphanPnrs.length > 0 && (
        <div className="mb-2 rounded-md border border-amber-200 bg-white px-3 py-2">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">PNR đã tạo (cần xử lý)</div>
          <div className="space-y-1.5">
            {partialHold.orphanPnrs.map((p, idx) => (
              <div key={`${p.pnr}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="apg-mono text-[13px] font-bold text-[#1a1a1a]">
                    {p.airline ? `${p.airline} · ` : ''}{p.pnr}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {p.from && p.to ? `${p.from} → ${p.to}` : ''}
                    {p.status ? ` · ${p.status}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(p.pnr).catch(() => {});
                    }
                  }}
                >
                  Copy PNR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href="tel:0918752686"
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
        >
          📞 Gọi CSKH 0918.752.686
        </a>
        <button
          type="button"
          onClick={() => window.open('https://booking.namthanh.vn/booking/reservation-status', '_blank', 'noopener,noreferrer')}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Mở Nam Thanh booking
        </button>
        <button
          type="button"
          onClick={() => { setPartialHold(null); setError(''); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Đóng cảnh báo
        </button>
      </div>
    </div>
  ) : null;

  const errorBlock = (error || partialHold) ? (
    <div className="space-y-2">
      {partialHoldBlock}
      {error && !partialHold && (
        <div role="alert" className="rounded-[var(--apg-radius-md)] border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">{error}</div>
      )}
      {holdTimedOut && (
        <button
          type="button"
          className="apg-btn-secondary h-10 px-3 text-xs font-semibold text-[var(--apg-aviation-navy)]"
          onClick={() => window.open('https://booking.namthanh.vn/booking/reservation-status', '_blank', 'noopener,noreferrer')}
        >
          Mở lịch sử đặt chỗ
        </button>
      )}
    </div>
  ) : null;

  // Trạng thái PNR thô từ đối tác → nhãn tiếng Việt (chỉ dịch nhãn đã biết, không bịa trạng thái).
  function pnrStatusVi(status: string) {
    const s = status.trim().toUpperCase();
    if (s === 'SUCCESS' || s === 'OK' || s === 'HK') return 'Đã giữ chỗ';
    return status;
  }

  const successDeadline = pnrRows.find((row) => row.timelimit)?.timelimit || result?.holdExpiresAt || '';

  // Màn "Giữ chỗ thành công": thay toàn bộ form sau khi hold OK — hero xác nhận,
  // hạn giữ chỗ, 2 CTA lớn (Thanh toán ngay / Thanh toán sau) trên fold, chi tiết PNR gọn bên dưới.
  const successView = result ? (
    <div className="mx-auto w-full max-w-[880px] px-4 py-8 lg:py-12">
      {/* Hero xác nhận */}
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
          <Check size={34} strokeWidth={3} className="text-emerald-600" />
        </div>
        <h2 className="mt-4 text-[26px] font-bold leading-tight text-[var(--apg-aviation-navy)] lg:text-[30px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>
          Giữ chỗ thành công
        </h2>
        <p className="mx-auto mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-slate-600">
          {result.orderCode && <>Mã đơn hàng <b className="apg-mono text-[var(--apg-aviation-navy)]">{result.orderCode}</b>.</>}
          {email.trim() && <> Email xác nhận kèm hướng dẫn thanh toán đang được gửi tới <b>{email.trim()}</b>.</>}
        </p>
      </div>

      {/* Hạn giữ chỗ */}
      {successDeadline && (
        <div className="mx-auto mt-6 flex max-w-[640px] items-start justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
          <span>Vé đang được giữ đến <b>{successDeadline}</b> — thanh toán trước hạn để xuất vé, quá hạn chỗ sẽ tự huỷ.</span>
        </div>
      )}

      {/* 2 lựa chọn tiếp theo */}
      {result.bookingId && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={`/booking/payment/${result.bookingId}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl p-5 text-white shadow-md transition hover:shadow-lg active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg,#0C2740,#143A5C 55%,#1A4E78)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3M20 17v4M14 20h3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="rounded-full border border-[#C7A24C]/60 bg-[#C7A24C]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#E3C77A]">Khuyên dùng</span>
            </div>
            <div className="mt-3.5 text-[17px] font-bold">Thanh toán ngay</div>
            {paymentTotal !== null && (
              <div className="apg-tabular mt-1 text-[24px] font-extrabold leading-none">{fmtVND(paymentTotal)}</div>
            )}
            <div className="mt-2 text-[12px] leading-relaxed text-white/75">Quét QR chuyển khoản — SePay đối soát và xuất vé tự động khi nhận đủ tiền.</div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
                Mở mã QR
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
              <span className="flex h-7 shrink-0 items-center rounded-full bg-white px-2.5">
                <Image src="/assets/sepay-logo.jpg" alt="SePay" width={64} height={20} className="h-[18px] w-auto object-contain" />
              </span>
            </div>
          </a>

          <a
            href={`/booking/payment/${result.bookingId}?later=1`}
            className="group flex flex-col rounded-2xl border-2 border-[var(--apg-border-default)] bg-white p-5 transition hover:border-[var(--apg-aviation-navy)]/40 hover:shadow-sm active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--apg-bg-surface-soft)] text-[var(--apg-aviation-navy)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
            </span>
            <div className="mt-3.5 text-[17px] font-bold text-[var(--apg-aviation-navy)]">Giữ chỗ · thanh toán sau</div>
            <div className="mt-2 text-[12px] leading-relaxed text-slate-500">
              Tải mặt vé đang giữ và thanh toán trước hạn{successDeadline ? <> <b className="text-slate-600">{successDeadline}</b></> : null}. Quá hạn chỗ sẽ tự huỷ.
            </div>
            <div className="mt-auto pt-4">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--apg-aviation-navy)]">
                Lấy mặt vé
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </a>
        </div>
      )}

      {/* Chi tiết giữ chỗ */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--apg-border-default)] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)]/60 px-4 py-3 lg:px-5">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--apg-aviation-navy)]">Chi tiết giữ chỗ</h3>
          <button
            type="button"
            aria-label="Copy thông tin giữ chỗ"
            onClick={copyHoldResultText}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--apg-border-default)] bg-white px-2.5 text-[11px] font-semibold text-[var(--apg-aviation-navy)] shadow-sm transition hover:border-[var(--apg-aviation-navy)]/40 active:scale-95"
          >
            {copiedResult ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2.4} />}
            {copiedResult ? 'Đã copy' : 'Copy'}
          </button>
        </div>

        <div className="divide-y divide-[var(--apg-border-default)]">
          {pnrRows.length > 0 ? pnrRows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 lg:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--apg-aviation-navy)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">{row.legLabel}</span>
                  <span className="apg-mono text-[16px] font-extrabold tracking-[0.04em] text-[#16212B]">{row.pnr}</span>
                  {row.airline && <span className="text-[11px] text-slate-500">{row.airline}</span>}
                  {row.status && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{pnrStatusVi(row.status)}</span>}
                </div>
                {row.routeLabel && <div className="mt-1 text-[12px] text-slate-600">{row.routeLabel}</div>}
                {row.flightSummary && <div className="mt-0.5 text-[11.5px] text-slate-500">{row.flightSummary}</div>}
                {row.timelimit && <div className="mt-0.5 text-[11.5px] font-medium text-amber-700">Giữ chỗ đến {row.timelimit}</div>}
                {row.message && <div className="mt-0.5 text-[11.5px] text-slate-500">{row.message}</div>}
              </div>
              <div className="text-right">
                <div className="apg-tabular text-[15px] font-extrabold text-[#16212B]">
                  {typeof row.totalAmount === 'number' ? fmtVND(row.totalAmount) : 'Đang đồng bộ'}
                </div>
                <div className="text-[10px] text-slate-400">Giá PNR</div>
              </div>
            </div>
          )) : (
            <div className="px-4 py-3.5 text-[12px] text-slate-500 lg:px-5">Chưa có dữ liệu PNR trả về.</div>
          )}

          <div className="space-y-1.5 bg-[var(--apg-bg-surface-soft)]/50 px-4 py-3.5 lg:px-5">
            {result.passenger && (
              <div className="flex justify-between gap-3 text-[12px] text-slate-600"><span>Hành khách</span><b className="text-right">{result.passenger}</b></div>
            )}
            {baggageTotal > 0 && (
              <div className="flex justify-between gap-3 text-[12px] text-slate-600"><span>Hành lý ký gửi (đã cộng)</span><span className="apg-tabular">{fmtVND(baggageTotal)}</span></div>
            )}
            {paymentTotal !== null && (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--apg-border-default)] pt-2">
                <span className="text-[13px] font-semibold text-[var(--apg-aviation-navy)]">Tổng thanh toán</span>
                <span className="apg-tabular text-[18px] font-extrabold text-[var(--apg-aviation-navy)]">{fmtVND(paymentTotal)}</span>
              </div>
            )}
            {pricing && (
              <div className="text-right text-[10.5px] italic text-slate-400">
                {pricing.verified === true
                  ? 'Giá đã xác thực theo PNR từ hệ thống giữ chỗ'
                  : 'Giá ước tính — đang đồng bộ theo PNR'}
              </div>
            )}
            {shouldShowPricingPending && (
              <div className="text-[11px] text-slate-500">
                {pricing?.message || 'Đang đồng bộ giá chuẩn từ hệ thống Nam Thanh...'}
                {unresolvedPricingPnrs.length > 0 ? ` · PNR chờ đồng bộ: ${unresolvedPricingPnrs.join(', ')}` : ''}
              </div>
            )}
            {result.splitRoundtrip && (
              <div className="text-[11px] text-slate-500">Hành trình khác hãng: đã tách thành 2 PNR riêng, vé mỗi chiều xuất độc lập.</div>
            )}
          </div>
        </div>
      </div>

      {/* Footnote */}
      <p className="mt-6 text-center text-[12px] leading-relaxed text-slate-500">
        Xem lại đơn &amp; tải mặt vé bất cứ lúc nào tại{' '}
        <a href="/tra-cuu" className="font-semibold text-[var(--apg-aviation-navy)] underline">Chuyến bay của tôi</a> (mã đơn + số điện thoại).
        <br className="hidden sm:block" />
        {' '}Cần hỗ trợ? <a href="tel:0918752686" className="font-bold text-[var(--apg-aviation-navy)]">0918.752.686</a>
        {' '}·{' '}
        <a href="https://zalo.me/0918752686" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--apg-aviation-navy)] underline">Chat Zalo</a>
      </p>
    </div>
  ) : null;

  /* ───────── Render ───────── */

  return (
    <div
      className={asPage
        ? "min-h-screen bg-[#F4F2EC] px-2 py-4 lg:px-6 lg:py-6"
        : "fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-2 lg:items-center lg:p-6"}
      onClick={asPage ? undefined : (e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {asPage && result?.priceDelta && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full ${result.priceDelta.percent.startsWith('-') ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={result.priceDelta.percent.startsWith('-') ? '#047857' : '#b45309'} strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            </div>
            <h3 className="text-[18px] font-bold text-[var(--apg-aviation-navy)]">{result.priceDelta.percent.startsWith('-') ? 'Giá vé vừa giảm' : 'Giá vé vừa tăng'}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">Giá hãng đã cập nhật giữa lúc bạn xem và lúc giữ chỗ. Vui lòng xác nhận giá mới trước khi thanh toán.</p>
            <div className="mt-4 space-y-1.5 rounded-xl border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-3 text-left text-[13px]">
              <div className="flex justify-between text-slate-500"><span>Giá đã xem</span><span className="apg-tabular line-through">{fmtVND(Number(result.priceDelta.before) || 0)}</span></div>
              <div className="flex items-center justify-between"><span className="font-semibold text-[var(--apg-aviation-navy)]">Giá hiện tại</span><span className="apg-tabular text-[16px] font-bold text-[var(--apg-aviation-navy)]">{fmtVND(Number(result.priceDelta.after) || 0)}</span></div>
              <div className={`text-right text-[12px] font-semibold ${result.priceDelta.percent.startsWith('-') ? 'text-emerald-700' : 'text-amber-700'}`}>{result.priceDelta.percent}%</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={onClose} className="h-11 rounded-lg border border-[var(--apg-border-default)] text-sm font-semibold text-slate-600 hover:bg-slate-50">Để sau</button>
              <button type="button" onClick={() => { if (onHeld && result.bookingId) onHeld(String(result.bookingId)); if (result.bookingId) window.location.href = `/booking/payment/${result.bookingId}`; }} className="h-11 rounded-lg text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#0C2740,#143A5C,#1A4E78)' }}>Đồng ý &amp; thanh toán</button>
            </div>
          </div>
        </div>
      )}
      <div
        className={asPage
          ? "mx-auto flex w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[var(--apg-border-default)]"
          : "mb-2 flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[var(--apg-border-default)] lg:mb-0 lg:max-h-[92vh] lg:max-w-[1200px]"}
      >
        {/* Header */}
        {asPage ? (
          <SiteGlobeHeader
            right={
              <>
                <div className="flex flex-shrink-0 flex-col items-end whitespace-nowrap rounded-lg px-2.5 py-1.5" style={{ border: '1px solid rgba(199,162,76,.55)', background: 'rgba(199,162,76,.12)' }}>
                  <span className="text-[8px] font-bold tracking-[0.16em] text-[#E3C77A]">{result?.orderCode ? 'MÃ ĐƠN HÀNG' : 'MÃ THAM CHIẾU'}</span>
                  <span className="apg-tabular text-[13px] font-extrabold tracking-[0.04em] text-white">{result?.orderCode || quoteCodeProp || quoteCode}</span>
                </div>
                {onExportQuote && (
                  <button type="button" onClick={onExportQuote} title="Xuất báo giá" className="hidden h-9 items-center gap-1.5 rounded-md border border-white/25 px-2.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 sm:inline-flex">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>
                    <span className="hidden sm:inline">Báo giá</span>
                  </button>
                )}
                <button type="button" aria-label="Quay lại" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-white/80 hover:bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </>
            }
          />
        ) : (
          <div className="border-b border-[var(--apg-border-default)] bg-white px-4 pt-4 pb-3 lg:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="apg-display text-[18px] font-semibold tracking-[0.04em] text-[var(--apg-aviation-navy)] lg:text-[20px]">Nhập thông tin đặt vé</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 lg:text-xs">
                  {splitRoundtrip ? <>Khác hãng: hệ thống sẽ tạo <b>2 PNR riêng</b>.</> : isRoundtrip ? 'Khứ hồi cùng hãng: giữ cả chiều đi và chiều về trong 1 PNR.' : 'Hệ thống sẽ tạo PNR giữ chỗ thật sau khi gửi thông tin.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={onClose}
                className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        )}
        {/* Stepper (white strip) */}
        <div className="border-b border-[var(--apg-border-default)] bg-white px-4 py-3 lg:px-6">
          {stepperBlock}
        </div>

        {/* Body: sau khi giữ chỗ thành công thay toàn bộ form bằng màn xác nhận */}
        <div ref={bodyScrollRef} className="flex-1 overflow-auto bg-[var(--apg-bg-page)]">
          {result ? successView : (
          <div className="mx-auto grid w-full max-w-[1200px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:p-6">
            {/* Sidebar (mobile: top, desktop: right sticky) */}
            <aside className="space-y-3 lg:order-2 lg:sticky lg:top-4 lg:self-start">
              {tripBanner}
              {itineraryBlock}
              <div className="lg:block hidden">
                {progressBlock}
                {errorBlock}
              </div>
            </aside>

            {/* Main form column */}
            <div className="space-y-4 lg:order-1">
              {/* Passengers */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--apg-aviation-navy)] text-[12px] font-bold text-white">1</span>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#16212B]">Hành khách</h3>
                    <p className="text-[11px] text-[#7a8794]">Thông tin theo giấy tờ tuỳ thân · {passengers.length} khách</p>
                  </div>
                </div>

                {passengers.map((passenger, index) => {
                  const passengerIndex = Number(passenger.id.replace(passenger.type, '')) || index + 1;
                  const titleOptions = titleOptionsFor(passenger.type);
                  const detailsOpen = !!expandedDetails[passenger.id];
                  const dobRequired = passenger.type !== 'ADT';
                  const pErr = passengerErrors[passenger.id];
                  const ticketName = `${compactUpper(passenger.lastName)} ${compactUpper(passenger.firstName)}`.trim();

                  return (
                    <div key={passenger.id} className={`overflow-hidden rounded-[var(--apg-radius-md)] border bg-white shadow-sm ${pErr ? 'border-rose-300 ring-1 ring-rose-200' : 'border-[var(--apg-border-default)]'}`}>
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="apg-display text-[13px] font-semibold tracking-[0.04em] text-[var(--apg-aviation-navy)]">
                            Hành khách {passengerIndex} · {passengerKindLabel(passenger.type)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 px-4 py-4">
                        {/* Identity row: title / last / first */}
                        <div className="grid grid-cols-12 gap-3">
                          <label className="col-span-4 text-[11px] font-semibold text-slate-700 sm:col-span-3 lg:col-span-3">
                            Quý danh <span className="text-rose-500">*</span>
                            <select
                              className="mt-1 h-11 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                              value={passenger.title}
                              onChange={(e) => updatePassenger(index, { title: compactUpper(e.target.value) })}
                            >
                              {titleOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </label>

                          <label className="col-span-8 text-[11px] font-semibold text-slate-700 sm:col-span-4 lg:col-span-4">
                            Họ <span className="text-rose-500">*</span>
                            <input
                              autoComplete="family-name"
                              className={`mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 ${pErr?.lastName ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : 'border-[var(--apg-border-default)] focus:border-[var(--apg-aviation-navy)] focus:ring-[var(--apg-aviation-navy)]/30'}`}
                              value={passenger.lastName}
                              onChange={(e) => updatePassenger(index, { lastName: sanitizeNamePart(e.target.value) })}
                              placeholder="NGUYEN"
                              aria-invalid={pErr?.lastName ? true : undefined}
                            />
                          </label>

                          <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-5 lg:col-span-5">
                            Đệm và tên <span className="text-rose-500">*</span>
                            <input
                              autoComplete="given-name"
                              className={`mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 ${pErr?.firstName ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : 'border-[var(--apg-border-default)] focus:border-[var(--apg-aviation-navy)] focus:ring-[var(--apg-aviation-navy)]/30'}`}
                              value={passenger.firstName}
                              onChange={(e) => updatePassenger(index, { firstName: sanitizeNamePart(e.target.value) })}
                              placeholder="VAN AN"
                              aria-invalid={pErr?.firstName ? true : undefined}
                            />
                          </label>

                          {(pErr?.lastName || pErr?.firstName) ? (
                            <p className="col-span-12 -mt-1 text-[11px] font-semibold text-rose-600">{pErr?.lastName || pErr?.firstName}</p>
                          ) : (
                            <p className="col-span-12 -mt-1 text-[11px] text-slate-500">Viết liền không dấu, đúng theo CCCD/Hộ chiếu (ví dụ: <b>NGUYEN</b> / <b>VAN AN</b>).</p>
                          )}
                          {ticketName ? (
                            <div className="col-span-12 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-[var(--apg-bg-surface-soft)] px-2.5 py-1.5 text-[11px]">
                              <span className="text-slate-500">Tên trên vé:</span>
                              <b className="uppercase tracking-[0.03em] text-[var(--apg-aviation-navy)]">{ticketName}</b>
                              <span className="text-amber-700">· phải khớp CCCD/Hộ chiếu — sai tên vé không đổi được</span>
                            </div>
                          ) : null}
                        </div>

                        {/* DOB row */}
                        <div className="grid grid-cols-12 gap-3">
                          <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-6">
                            Ngày sinh {dobRequired ? <span className="text-rose-500">*</span> : <span className="text-slate-400">(khuyến nghị)</span>}
                            <input
                              type="date"
                              max={new Date().toISOString().slice(0, 10)}
                              className={`mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 ${pErr?.dateOfBirth ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : 'border-[var(--apg-border-default)] focus:border-[var(--apg-aviation-navy)] focus:ring-[var(--apg-aviation-navy)]/30'}`}
                              value={passenger.dateOfBirth}
                              onChange={(e) => updatePassenger(index, { dateOfBirth: e.target.value })}
                              aria-invalid={pErr?.dateOfBirth ? true : undefined}
                            />
                            {pErr?.dateOfBirth ? (
                              <p className="mt-1 text-[11px] font-semibold text-rose-600">{pErr.dateOfBirth}</p>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-500">{dobRequired ? 'Bắt buộc với trẻ em / em bé.' : 'Bắt buộc với trẻ em < 12 tuổi.'}</p>
                            )}
                          </label>
                        </div>

                        {/* Collapsible: passport + loyalty */}
                        <div className="rounded-[var(--apg-radius-md)] border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)]/40">
                          <button
                            type="button"
                            onClick={() => setExpandedDetails((prev) => ({ ...prev, [passenger.id]: !detailsOpen }))}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--apg-aviation-navy)] hover:bg-[var(--apg-bg-surface-soft)]/70"
                            aria-expanded={detailsOpen}
                          >
                            <span>Bổ sung thông tin · CCCD/Hộ chiếu &amp; thẻ thành viên</span>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          {detailsOpen && (
                            <div className="space-y-3 border-t border-[var(--apg-border-default)] px-3 py-3">
                              <div className="grid grid-cols-12 gap-3">
                                <label className="col-span-12 text-[11px] font-medium text-slate-700 sm:col-span-6">
                                  Số CCCD/Hộ chiếu
                                  <input
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.passportNumber}
                                    onChange={(e) => updatePassenger(index, { passportNumber: e.target.value.toUpperCase() })}
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Quốc tịch
                                  <input
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.passportNationality}
                                    onChange={(e) => updatePassenger(index, { passportNationality: e.target.value.toUpperCase() })}
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Quốc gia cấp
                                  <input
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.passportIssuingCountry}
                                    onChange={(e) => updatePassenger(index, { passportIssuingCountry: e.target.value.toUpperCase() })}
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Ngày cấp
                                  <input
                                    type="date"
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.passportIssueDate}
                                    onChange={(e) => updatePassenger(index, { passportIssueDate: e.target.value })}
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Ngày hết hạn
                                  <input
                                    type="date"
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.passportExpiryDate}
                                    onChange={(e) => updatePassenger(index, { passportExpiryDate: e.target.value })}
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Thẻ thành viên (hãng)
                                  <input
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.loyaltyAirline}
                                    onChange={(e) => updatePassenger(index, { loyaltyAirline: e.target.value.toUpperCase() })}
                                    placeholder="VJ / VN / QH"
                                  />
                                </label>
                                <label className="col-span-6 text-[11px] font-medium text-slate-700 sm:col-span-3">
                                  Số thẻ thành viên
                                  <input
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={passenger.loyaltyNumber}
                                    onChange={(e) => updatePassenger(index, { loyaltyNumber: e.target.value.toUpperCase() })}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Baggage — section 2 */}
              <section className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--apg-aviation-navy)] text-[12px] font-bold text-white">2</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-bold text-[#16212B]">Hành lý ký gửi</h3>
                    <p className="text-[11px] text-[#7a8794]">Tùy chọn · giá vé đã gồm 7kg xách tay</p>
                  </div>
                  {skipBaggage && (
                    <button
                      type="button"
                      onClick={() => { setSkipBaggage(false); setAncillaryAttempt((n) => n + 1); }}
                      className="shrink-0 rounded-full border border-[var(--apg-border-default)] bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[var(--apg-aviation-navy)] hover:border-[var(--apg-brand-gold)]"
                    >
                      ↺ Tải lại hành lý
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2.5">
                  {ancillaryLoading && (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
                          <div className="h-3 animate-pulse rounded bg-slate-200/70" />
                          <div className="h-9 animate-pulse rounded bg-slate-200/50" />
                        </div>
                      ))}
                    </div>
                  )}
                  {!ancillaryLoading && ancillaryError && !skipBaggage && (
                    <div className="space-y-2 rounded-[var(--apg-radius-sm)] border border-red-200 bg-red-50/60 px-3 py-2.5">
                      <div className="flex items-start gap-2 text-xs text-red-700">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z"/></svg>
                        <span className="leading-relaxed">{ancillaryError}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAncillaryAttempt((n) => n + 1)}
                          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:border-red-400 hover:bg-red-50"
                        >
                          ↺ Thử lại
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSkipBaggage(true); setAncillaryError(''); setAncillaryRoutes([]); }}
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Tiếp tục giữ chỗ không kèm hành lý →
                        </button>
                      </div>
                    </div>
                  )}
                  {!ancillaryLoading && skipBaggage && (
                    <div className="rounded-[var(--apg-radius-sm)] border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
                      Bạn đang giữ chỗ <strong>không kèm hành lý ký gửi</strong>. Có thể mua thêm tại sân bay hoặc trên web hãng sau khi có PNR.
                    </div>
                  )}
                  {!ancillaryLoading && !ancillaryError && !skipBaggage && ancillaryWarning && (
                    <div className="text-xs text-amber-700">{ancillaryWarning}</div>
                  )}
                  {!ancillaryLoading && !ancillaryError && !skipBaggage && passengers.map((passenger, index) => {
                    const routeOptions = ancillaryRoutes
                      .map((route) => ({ ...route, options: baggageServicesForPassenger(route, passenger) }))
                      .filter((route) => route.options.length > 0);
                    return (
                      <div key={passenger.id} className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)]/40 px-3 py-2.5">
                        <div className="mb-1.5 text-[11px] font-bold text-[var(--apg-aviation-navy)]">Khách {index + 1} · {passengerKindLabel(passenger.type)}</div>
                        {routeOptions.length === 0 ? (
                          <div className="text-[11px] text-slate-500">Chưa có gói hành lý phù hợp cho hành khách này.</div>
                        ) : (
                          <div className="grid gap-2 lg:grid-cols-2">
                            {routeOptions.map((route) => {
                              const routeAirline = compactUpper(route.airline || '');
                              const selected = passenger.listLuggage.find(
                                (item) =>
                                  item.route === route.route &&
                                  Number(item.segmentId || 0) === Number(route.segmentId || 0) &&
                                  compactUpper(item.airline || '') === routeAirline
                              );
                              return (
                                <label key={`${route.route}-${route.segmentId}-${route.airline || 'ANY'}`} className="block text-[11px] font-medium text-slate-700">
                                  {routeCodeLabel(airports, route.route)} {route.airline ? `(${route.airline})` : ''}
                                  <select
                                    className="mt-1 h-10 w-full rounded-md border border-[var(--apg-border-default)] bg-white px-2.5 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none"
                                    value={selected?.key || ''}
                                    onChange={(e) => updatePassengerLuggage(
                                      index,
                                      route.route,
                                      Number(route.segmentId || 0),
                                      route.airline,
                                      e.target.value,
                                      route.options
                                    )}
                                  >
                                    <option value="">Không mua hành lý</option>
                                    {route.options.map((option) => (
                                      <option key={`${route.route}-${route.segmentId}-${option.key}`} value={option.key}>
                                        {option.description} - {fmtVND(option.price || 0)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Contact */}
              <section className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--apg-aviation-navy)] text-[12px] font-bold text-white">3</span>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#16212B]">Người liên hệ</h3>
                    <p className="text-[11px] text-[#7a8794]">Nhận xác nhận giữ chỗ &amp; vé điện tử</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-12 gap-3">
                  <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-7">
                    Email <span className="text-rose-500">*</span>
                    <input
                      type="email"
                      autoComplete="email"
                      className="mt-1 h-11 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="khachhang@example.com"
                    />
                  </label>
                  <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-5">
                    Số điện thoại <span className="text-rose-500">*</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="mt-1 h-11 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0918 752 686"
                    />
                  </label>
                </div>
              </section>

              {/* Xuất hóa đơn VAT (tùy chọn) */}
              <section className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-4 py-3.5 shadow-sm">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={vatWanted}
                    onChange={(e) => setVatWanted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--apg-aviation-navy)]"
                  />
                  <span>
                    <span className="text-[13px] font-bold text-[#16212B]">Xuất hóa đơn VAT</span>
                    <span className="mt-0.5 block text-[11px] text-[#7a8794]">Cho khách doanh nghiệp · hóa đơn gửi qua email sau khi xuất vé</span>
                  </span>
                </label>
                {vatWanted && (
                  <div className="mt-3 grid grid-cols-12 gap-3">
                    <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-7">
                      Tên đơn vị
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                        value={vat.companyName}
                        onChange={(e) => setVat((v) => ({ ...v, companyName: e.target.value }))}
                        placeholder="Công ty TNHH ..."
                      />
                    </label>
                    <label className="col-span-12 text-[11px] font-semibold text-slate-700 sm:col-span-5">
                      Mã số thuế
                      <input
                        inputMode="numeric"
                        className="mt-1 h-10 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                        value={vat.taxId}
                        onChange={(e) => setVat((v) => ({ ...v, taxId: e.target.value.replace(/[^0-9-]/g, '') }))}
                        placeholder="0xxxxxxxxx"
                      />
                    </label>
                    <label className="col-span-12 text-[11px] font-semibold text-slate-700">
                      Địa chỉ
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                        value={vat.address}
                        onChange={(e) => setVat((v) => ({ ...v, address: e.target.value }))}
                        placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
                      />
                    </label>
                    <label className="col-span-12 text-[11px] font-semibold text-slate-700">
                      Email nhận hóa đơn <span className="font-normal text-slate-400">(để trống = dùng email liên hệ)</span>
                      <input
                        type="email"
                        className="mt-1 h-10 w-full rounded-lg border border-[var(--apg-border-default)] bg-white px-3 text-sm focus:border-[var(--apg-aviation-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--apg-aviation-navy)]/30"
                        value={vat.email}
                        onChange={(e) => setVat((v) => ({ ...v, email: e.target.value }))}
                        placeholder="ketoan@congty.com"
                      />
                    </label>
                  </div>
                )}
              </section>

              {/* Cam kết */}
              <div className="space-y-1.5 pt-1 text-center">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-[#6b7682]">
                  <span className="inline-flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1f8a5b" strokeWidth="2.2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Không nhập thẻ trên web</span>
                  <span className="inline-flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1f8a5b" strokeWidth="2.4"><path d="M20 6 9 17l-5-5"/></svg> SePay đối soát tự động</span>
                  <span className="inline-flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C7A24C" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg> Vé điện tử qua email</span>
                </div>
                <div className="text-[11px] text-[#7a8794]">Cần hỗ trợ? <b className="text-[var(--apg-aviation-navy)]">0918.752.686</b> · Chat Zalo</div>
              </div>

              {/* Mobile-only progress/error (sidebar slot is hidden on mobile inside aside) */}
              <div className="space-y-3 lg:hidden">
                {progressBlock}
                {errorBlock}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Sticky footer (ẩn sau khi giữ chỗ thành công — CTA nằm trong màn xác nhận) */}
        {!result && (
        <div className="border-t border-[var(--apg-border-default)] bg-white px-4 py-3 lg:px-6">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a96a3]">Tổng thanh toán</div>
              <div className="apg-tabular text-[26px] font-extrabold leading-none text-[var(--apg-aviation-navy)]" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>{fmtVND(paymentTotal ?? estimatedTotal)}</div>
            </div>
            <div className="text-right text-[11px] leading-tight text-[#7a8794]">
              <div>{paxCount} khách · {holdFlights[0]?.departure.airport} {isRoundtrip ? '⇄' : '→'} {holdFlights[0]?.arrival.airport}{splitRoundtrip ? ' · 2 PNR riêng' : ''}</div>
              {refreshing ? (
                <div className="font-medium text-red-600">Đang tải giá mới…</div>
              ) : sessionExpired ? (
                <div className="font-medium text-red-600">Phiên đã hết hạn</div>
              ) : (
                <div>Phiên còn <SessionCountdown deadlineMs={sessionDeadlineMs} /></div>
              )}
            </div>
          </div>
          <>
              <label className="mb-2.5 flex items-start gap-2 text-[11.5px] leading-snug text-[#586675]">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--apg-aviation-navy)]"
                />
                <span>
                  Tôi đã đọc và đồng ý{' '}
                  <a href="/hoan-doi-huy-ve" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--apg-aviation-navy)] underline">Điều kiện hoàn/đổi/hủy</a>
                  {' '}và{' '}
                  <a href="/huong-dan-dat-ve" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--apg-aviation-navy)] underline">Hướng dẫn đặt vé</a>.
                  {' '}Tên hành khách phải khớp CCCD/Hộ chiếu.
                </span>
              </label>
              <button
                type="button"
                onClick={submitHold}
                disabled={loading || sessionExpired || refreshing || !agreedTerms}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--apg-aviation-navy)] px-4 text-sm font-bold text-white transition hover:bg-[var(--apg-aviation-navy-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.2-8.55" /></svg>
                    Đang giữ chỗ...
                  </>
                ) : refreshing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.2-8.55" /></svg>
                    Đang tải lại giá mới...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    Giữ chỗ &amp; thanh toán
                  </>
                )}
              </button>
          </>
        </div>
        )}
      </div>
    </div>
  );
}
