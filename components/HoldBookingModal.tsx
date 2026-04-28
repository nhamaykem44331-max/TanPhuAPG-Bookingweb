"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
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
    .replace(/[\u0300-\u036f]/g, '')
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
  const topMessage = normalizeMessageText(body.error);
  const fieldErrors = fieldErrorsText(body.fieldErrors);
  const flatErrors = [nestedErrors, detailErrors, bodyErrors]
    .flatMap((source) => Object.entries(source))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .filter(Boolean);
  const parts = uniqueMessageParts([
    topMessage,
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

function splitName(fullName: string) {
  const tokens = compactUpper(fullName).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { lastName: '', firstName: '' };
  return {
    lastName: tokens[0],
    firstName: tokens.slice(1).join(' '),
  };
}

function dedupeByKey(items: BookingAncillaryService[]) {
  const map = new Map<string, BookingAncillaryService>();
  for (const item of items) {
    const key = `${item.route}|${item.segmentId}|${item.key}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

// Whitelist các serviceType được coi là HÀNH LÝ KÝ GỬI.
// Backend Nam Thanh trả nhiều loại (BAGGAGE, MEAL, SEAT, INSURANCE...) trong cùng response
// → Trước đây code không lọc, gây bug seat/meal lẫn vào dropdown hành lý.
const BAGGAGE_TYPE_PATTERN = /^(BAGGAGE|CHECKED[_-]?BAG|EXTRA[_-]?BAG|BAG)$/i;
const SEAT_TYPE_PATTERN = /^SEAT|^STSL/i;

function isBaggageService(service: BookingAncillaryService) {
  const type = String(service.serviceType || '').toUpperCase().trim();
  if (!type) return false;
  if (BAGGAGE_TYPE_PATTERN.test(type)) return true;
  // Một số hãng đặt code BG, BG15, BG23 mà không set serviceType chuẩn
  const code = String(service.code || '').toUpperCase();
  if (/^BG\d*/i.test(code) || /\bBAGGAGE\b/i.test(service.description || '')) return true;
  return false;
}

function isSeatService(service: BookingAncillaryService) {
  const type = String(service.serviceType || '').toUpperCase().trim();
  if (SEAT_TYPE_PATTERN.test(type)) return true;
  // Code chỗ ngồi thường có dạng "21A", "12B" v.v.
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

// Phase 1 chưa render seat picker — chỉ tiện thể loại bỏ seat khỏi dropdown baggage.
// Phase 2 sẽ dùng hàm này để render seat map.
export function _seatServicesForPassenger(route: AncillaryRoute, passenger: UiPassenger) {
  return servicesForPassenger(route, passenger).filter(isSeatService);
}

function passengerValidationError(passenger: UiPassenger, index: number) {
  const normalizedName = compactUpper(passenger.fullName);
  const tokenCount = normalizedName.split(/\s+/).filter(Boolean).length;
  if (!normalizedName || tokenCount < 2) {
    return `${passengerLabel(passenger.type, index)} cần họ tên đầy đủ (tối thiểu 2 từ).`;
  }
  if (passenger.type === 'CHD' && !passenger.dateOfBirth) {
    return `${passengerLabel(passenger.type, index)} bắt buộc có ngày sinh.`;
  }
  return '';
}

function buildPassengerPayload(passenger: UiPassenger): HoldBookingPassenger {
  const fullName = compactUpper(passenger.fullName);
  const split = splitName(fullName);
  const lastName = compactUpper(passenger.lastName) || split.lastName;
  const firstName = compactUpper(passenger.firstName) || split.firstName;
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
}) {
  const { airports } = useAirports();
  const [passengers, setPassengers] = useState<UiPassenger[]>(() => buildPassengerSeeds(adults, children, infants));
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [createRealHold, setCreateRealHold] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Khi split-roundtrip outbound thành công nhưng inbound fail → lưu PNR mồ côi để hiển thị
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
  const [ancillaryAttempt, setAncillaryAttempt] = useState(0); // ép re-fetch khi user bấm "Thử lại"
  const [skipBaggage, setSkipBaggage] = useState(false);       // user chọn "tiếp tục không kèm hành lý"
  const resultRef = useRef<HoldBookingResponse | null>(null);

  const isRoundtrip = tripType === 'roundtrip' && !!inbound;
  const splitRoundtrip = isRoundtrip &&
    String(flight?.airlineCode || '').toUpperCase() !== String(inbound?.airlineCode || '').toUpperCase();
  const holdFlights = useMemo(() => (
    flight ? [flight, ...(isRoundtrip && inbound ? [inbound] : [])] : []
  ), [flight, inbound, isRoundtrip]);
  const estimatedTotal = holdFlights.reduce((sum, item) => sum + (item.fareBreakdown?.totalAmount ?? item.price.amount ?? 0), 0);
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
      .map((p) => `${p.id}-${compactUpper(p.fullName)}-${p.dateOfBirth}`)
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
  }, [open, adults, children, infants]);

  useEffect(() => {
    resultRef.current = result;
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
    if (skipBaggage) return; // user đã chọn "không kèm hành lý" → không fetch nữa
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
    ancillaryAttempt, // bấm "Thử lại" → tăng attempt → re-run effect
    skipBaggage,
  ]);

  // Reset state khi modal đóng để lần mở sau bắt đầu sạch
  useEffect(() => {
    if (open) return;
    setSkipBaggage(false);
    setAncillaryAttempt(0);
    setPartialHold(null);
  }, [open]);

  if (!open || !flight) return null;

  const updatePassenger = (index: number, patch: Partial<UiPassenger>) => {
    setPassengers((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updatePassengerLuggage = (
    index: number,
    routeCode: string,
    segmentId: number,
    selectedKey: string,
    available: BookingAncillaryService[]
  ) => {
    setPassengers((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const kept = item.listLuggage.filter(
        (luggage) => !(luggage.route === routeCode && Number(luggage.segmentId || 0) === segmentId)
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
      passengers.forEach((passenger, idx) => {
        const errorText = passengerValidationError(passenger, idx + 1);
        if (errorText) throw new Error(errorText);
      });

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
          displayedNetPrice: estimatedTotal,
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
          dryRun: !createRealHold,
          idempotencyKey,
        }),
      });
      if (createRealHold) {
        setHoldProgressPct((prev) => Math.max(prev, 85));
        setHoldProgressText('Đang đồng bộ giá chuẩn từ ticket-info-by-id...');
      }
      const data = await res.json();
      if (!res.ok || data.success === false) {
        // Phát hiện PARTIAL_HOLD (orphan PNR) → lưu riêng để hiển thị block đỏ rõ ràng
        const errorBody = recordOf(data);
        if (errorBody.error === 'PARTIAL_HOLD' && Array.isArray(errorBody.orphanPnrs)) {
          setPartialHold({
            orphanPnrs: errorBody.orphanPnrs as Array<{ airline?: string; pnr: string; status?: string; from?: string; to?: string }>,
            cancelStatus: (errorBody.orphanCancelStatus as 'AUTO_CANCELLED' | 'PARTIAL_CANCELLED' | 'NEEDS_MANUAL_CANCEL') || 'NEEDS_MANUAL_CANCEL',
            detail: String(errorBody.detail || ''),
          });
          // Vẫn set error để giữ block lỗi cũ chạy song song nếu cần
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setHoldTimedOut(true);
        setError('Hệ thống Nam Thanh phản hồi quá chậm (>3 phút). Mã đặt chỗ có thể đã tạo — vui lòng kiểm tra trong lịch sử đặt chỗ.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const summaryBlock = (
    <div className="apg-panel space-y-3 px-3 py-3">
      {holdFlights.map((item, index) => {
        const amount = item.fareBreakdown?.totalAmount ?? item.price.amount ?? 0;
        return (
          <div key={`${item.id}-${index}`} className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-3 text-xs">
            <div className="apg-display text-[12px] font-semibold tracking-[0.04em] text-[var(--apg-aviation-navy)]">{isRoundtrip ? (index === 0 ? 'Chiều đi' : 'Chiều về') : 'Chuyến bay'} - {item.airlineCode} {item.flightNumber}</div>
            <div className="text-slate-600">
              {airportEndpointLabel(airports, item.departure)} {hhmm(item.departure.time)} - {airportEndpointLabel(airports, item.arrival)} {hhmm(item.arrival.time)}
            </div>
            <div className="mt-1 flex justify-between">
              <span>{item.namthanh?.class || ''} {item.namthanh?.cabinClass || ''}</span>
              <span className="apg-tabular font-bold">{fmtVND(amount)}</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white px-3 py-2 text-xs font-bold">
        <span>Tổng hành trình (ước tính)</span>
        <span className="apg-tabular">{fmtVND(estimatedTotal)}</span>
      </div>
      <div className="text-[11px] text-slate-500">
        Giá trên là ước tính theo fare snapshot. Giá chuẩn sẽ đồng bộ theo PNR sau khi giữ chỗ.
      </div>
    </div>
  );

  const progressBlock = showHoldProgress ? (
    <div className="apg-panel px-3 py-3">
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

      {/* Trạng thái auto-cancel */}
      <div className="mb-2 rounded-md border border-amber-200 bg-white/70 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Trạng thái xử lý tự động</div>
        <div className="mt-1 text-[12px] text-amber-900">
          {partialHold.cancelStatus === 'AUTO_CANCELLED' && (
            <span className="font-semibold text-emerald-700">✓ Đã tự động huỷ thành công các PNR mồ côi. Anh/chị có thể thử lại.</span>
          )}
          {partialHold.cancelStatus === 'PARTIAL_CANCELLED' && (
            <span className="font-semibold text-orange-700">⚠ Đã huỷ được một phần. Vui lòng kiểm tra danh sách bên dưới và liên hệ CSKH cho PNR còn lại.</span>
          )}
          {partialHold.cancelStatus === 'NEEDS_MANUAL_CANCEL' && (
            <span className="font-semibold text-red-700">✗ Auto-cancel không khả dụng. Vui lòng liên hệ CSKH (Hotline 0918.752.686) để huỷ thủ công các PNR dưới đây.</span>
          )}
        </div>
      </div>

      {/* Danh sách PNR mồ côi */}
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

      {/* Quick actions */}
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
        <div className="rounded-[var(--apg-radius-md)] border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">{error}</div>
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

  const resultBlock = result ? (
    <div className="rounded-[var(--apg-radius-md)] border border-green-200 bg-green-50 px-3 py-3 text-xs text-green-800">
      <div className="font-bold">{result.dryRun ? 'Kiểm tra thử thành công' : 'Giữ chỗ OK'}</div>
      {result.orderCode && <div>Mã đơn hàng: <b>{result.orderCode}</b></div>}
      {result.sessionID && <div>Phiên: {result.sessionID}</div>}
      {result.passenger && <div>Khách: {result.passenger}</div>}
      {result.dryRun && typeof result.totalAmount === 'number' && (
        <div>Tổng ước tính (kiểm tra thử): {fmtVND(result.totalAmount)}</div>
      )}
      {hasVerifiedPricing && typeof result?.totalAmount === 'number' && (
        <div className="font-semibold">Tổng chuẩn: {fmtVND(result.totalAmount)}</div>
      )}
      {!result.dryRun && pricing && (
        <div className="mt-0.5 text-[10px] text-gray-500 italic">
          {pricing.verified === true
            ? `Giá xác thực từ ${pricing.source || 'hệ thống Nam Thanh'}`
            : `Giá ước tính — đang đồng bộ từ ${pricing.source || 'hệ thống Nam Thanh'}`}
        </div>
      )}
      {shouldShowPricingPending && (
        <div>{pricing?.message || 'Đang đồng bộ giá chuẩn từ hệ thống Nam Thanh...'}</div>
      )}
      {shouldShowPricingPending && unresolvedPricingPnrs.length > 0 && (
        <div>PNR đang chờ đồng bộ giá: {unresolvedPricingPnrs.join(', ')}</div>
      )}
      {pricingByPnr.map((item) => (
        <div key={`pricing-live-${item.pnr}`} className="mt-1 rounded-[var(--apg-radius-sm)] bg-white/70 px-2 py-1">
          <div>
            Giá PNR <b>{item.pnr}</b>:{' '}
            {typeof item.totalAmount === 'number'
              ? <b>{fmtVND(item.totalAmount)}</b>
              : <span className="italic text-gray-500">Đang đồng bộ…</span>}
          </div>
          {item.timelimit && <div>Thời hạn giữ chỗ: {item.timelimit}</div>}
        </div>
      ))}
      {result.splitRoundtrip && <div>Khác hãng: đã tách thành 2 mã giữ chỗ/PNR riêng.</div>}
      {result.protectionVerified && <div>Đã xử lý xác thực Nam Thanh trước khi tạo PNR.</div>}
      {(result.pnrs || []).map((pnr, idx) => (
        <div key={`${pnr.pnr || idx}`} className="mt-1 rounded-[var(--apg-radius-sm)] bg-white/70 px-2 py-1">
          <div>PNR: <b>{pnr.pnr || '-'}</b> | {pnr.airline || '-'} | {pnr.status || '-'}</div>
          {pnr.timelimit && <div>Thời hạn giữ chỗ: {pnr.timelimit}</div>}
          {pnr.message && pnr.message !== pnr.pnr && <div>{pnr.message}</div>}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-2 lg:items-center lg:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mb-2 flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl lg:mb-0 lg:max-h-[92vh] lg:max-w-[1240px] lg:rounded-[var(--apg-radius-lg)]" style={{ border: '1px solid var(--apg-border-default)' }}>
        <div className="flex items-center justify-between border-b border-[var(--apg-border-default)] bg-white px-4 py-3 lg:px-5">
          <div>
            <div className="apg-display text-[18px] font-semibold tracking-[0.05em] text-[var(--apg-aviation-navy)]">Giữ chỗ Nam Thanh</div>
            <div className="text-[11px] text-slate-500">
              {splitRoundtrip ? 'Khác hãng: hệ thống sẽ tạo 2 PNR riêng.' : isRoundtrip ? 'Khứ hồi cùng hãng: giữ cả chiều đi và chiều về.' : 'Mặc định là kiểm tra thử, chưa tạo PNR thật.'}
            </div>
          </div>
          <button className="apg-btn-secondary h-9 px-3 text-xs font-semibold" onClick={onClose}>Đóng</button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 lg:bg-[var(--apg-bg-page)] lg:px-5 lg:py-5">
          <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5">
            <aside className="hidden lg:block">
              <div className="sticky top-3 space-y-3">
                {summaryBlock}
                {progressBlock}
                {errorBlock}
                {resultBlock}
              </div>
            </aside>

            <div>
              <div className="space-y-2 lg:hidden">
                {summaryBlock}
              </div>

              <div className="mt-3 space-y-3 lg:mt-0">
            {passengers.map((passenger, index) => {
              const routeOptions = ancillaryRoutes
                .map((route) => ({
                  ...route,
                  options: baggageServicesForPassenger(route, passenger),
                }))
                .filter((route) => route.options.length > 0);

              return (
                <div key={passenger.id} className="overflow-hidden rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-white shadow-sm">
                  <div className="border-b border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-2 text-sm text-[#1a1a1a] lg:px-4 lg:py-3">
                    <span className="apg-display font-semibold tracking-[0.04em] text-[var(--apg-aviation-navy)]">
                    {passengerLabel(
                      passenger.type,
                      Number(passenger.id.replace(passenger.type, '')) || index + 1
                    )}
                    </span>
                  </div>
                  <div className="space-y-3 px-3 py-3 lg:px-4 lg:py-4">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4 lg:grid-cols-[150px_minmax(0,1fr)_180px]">
                      <label className="text-xs font-semibold text-[#7a6a52]">
                        Quý danh
                        <select
                          className="apg-field mt-1 px-2 text-sm"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.title}
                          onChange={(e) => updatePassenger(index, { title: compactUpper(e.target.value) })}
                        >
                          {passenger.type === 'ADT' ? (
                            <>
                              <option value="MR">MR</option>
                              <option value="MRS">MRS</option>
                              <option value="MS">MS</option>
                            </>
                          ) : (
                            <>
                              <option value="MSTR">MSTR</option>
                              <option value="MISS">MISS</option>
                            </>
                          )}
                        </select>
                      </label>

                      <label className="text-xs font-semibold text-[#7a6a52] md:col-span-2 lg:col-auto">
                        Họ tên đầy đủ {passenger.type === 'ADT' ? '*' : passenger.type === 'CHD' ? '* (trẻ em)' : '*'}
                        <input
                          className="apg-field mt-1 px-2 text-sm"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.fullName}
                          onChange={(e) => updatePassenger(index, { fullName: e.target.value.toUpperCase() })}
                          placeholder="NGUYỄN VĂN AN"
                        />
                      </label>

                      <label className="text-xs font-semibold text-[#7a6a52]">
                        Ngày sinh {passenger.type === 'CHD' ? '*' : '(tùy chọn)'}
                        <input
                          type="date"
                          className="apg-field mt-1 px-2 text-sm"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.dateOfBirth}
                          onChange={(e) => updatePassenger(index, { dateOfBirth: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="text-xs font-semibold text-[#7a6a52]">
                        Họ (tùy chọn)
                        <input
                          className="mt-1 w-full rounded-lg px-2 py-2 text-sm focus:outline-none"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.lastName}
                          onChange={(e) => updatePassenger(index, { lastName: e.target.value.toUpperCase() })}
                          placeholder="NGUYỄN"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#7a6a52] md:col-span-2 lg:col-auto">
                        Đệm và tên (tùy chọn)
                        <input
                          className="mt-1 w-full rounded-lg px-2 py-2 text-sm focus:outline-none"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.firstName}
                          onChange={(e) => updatePassenger(index, { firstName: e.target.value.toUpperCase() })}
                          placeholder="VĂN AN"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-2">
                      <label className="text-xs font-semibold text-[#7a6a52]">
                        Thẻ thành viên (hãng)
                        <input
                          className="mt-1 w-full rounded-lg px-2 py-2 text-sm focus:outline-none"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.loyaltyAirline}
                          onChange={(e) => updatePassenger(index, { loyaltyAirline: e.target.value.toUpperCase() })}
                          placeholder="VJ / VN / QH"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#7a6a52]">
                        Số thẻ thành viên
                        <input
                          className="mt-1 w-full rounded-lg px-2 py-2 text-sm focus:outline-none"
                          style={{ border: '1px solid #e8dcc8' }}
                          value={passenger.loyaltyNumber}
                          onChange={(e) => updatePassenger(index, { loyaltyNumber: e.target.value.toUpperCase() })}
                        />
                      </label>
                    </div>

                    <div className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-3">
                      <div className="apg-display mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--apg-brand-gold)]">Bổ sung thông tin</div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                        <label className="text-xs text-[#7a6a52] md:col-span-2">
                          Số hộ chiếu/CCCD
                          <input className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none" style={{ border: '1px solid #e8dcc8' }} value={passenger.passportNumber} onChange={(e) => updatePassenger(index, { passportNumber: e.target.value.toUpperCase() })} />
                        </label>
                        <label className="text-xs text-[#7a6a52]">
                          Quốc tịch
                          <input className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none" style={{ border: '1px solid #e8dcc8' }} value={passenger.passportNationality} onChange={(e) => updatePassenger(index, { passportNationality: e.target.value.toUpperCase() })} />
                        </label>
                        <label className="text-xs text-[#7a6a52]">
                          Quốc gia cấp
                          <input className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none" style={{ border: '1px solid #e8dcc8' }} value={passenger.passportIssuingCountry} onChange={(e) => updatePassenger(index, { passportIssuingCountry: e.target.value.toUpperCase() })} />
                        </label>
                        <label className="text-xs text-[#7a6a52]">
                          Ngày cấp
                          <input type="date" className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none" style={{ border: '1px solid #e8dcc8' }} value={passenger.passportIssueDate} onChange={(e) => updatePassenger(index, { passportIssueDate: e.target.value })} />
                        </label>
                        <label className="text-xs text-[#7a6a52] md:col-span-2">
                          Ngày hết hạn
                          <input type="date" className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none" style={{ border: '1px solid #e8dcc8' }} value={passenger.passportExpiryDate} onChange={(e) => updatePassenger(index, { passportExpiryDate: e.target.value })} />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-[var(--apg-radius-md)] border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-soft)] px-3 py-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="apg-display text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--apg-brand-gold)]">Hành lý ký gửi</div>
                        {skipBaggage && (
                          <button
                            type="button"
                            onClick={() => { setSkipBaggage(false); setAncillaryAttempt((n) => n + 1); }}
                            className="rounded-full border border-[var(--apg-border-default)] bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[var(--apg-aviation-navy)] hover:border-[var(--apg-brand-gold)]"
                          >
                            ↺ Tải lại hành lý
                          </button>
                        )}
                      </div>
                      {/* Skeleton loading */}
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
                      {/* Error state với nút Thử lại + Tiếp tục không kèm hành lý */}
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
                      {/* User đã chủ động skip → hiện thông báo gọn */}
                      {!ancillaryLoading && skipBaggage && (
                        <div className="rounded-[var(--apg-radius-sm)] border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
                          Bạn đang giữ chỗ <strong>không kèm hành lý ký gửi</strong>. Có thể mua thêm tại sân bay hoặc trên web hãng sau khi có PNR.
                        </div>
                      )}
                      {!ancillaryLoading && !ancillaryError && !skipBaggage && ancillaryWarning && (
                        <div className="text-xs text-amber-700">{ancillaryWarning}</div>
                      )}
                      {!ancillaryLoading && !ancillaryError && !ancillaryWarning && !skipBaggage && routeOptions.length === 0 && (
                        <div className="text-xs text-slate-500">Chưa có gói hành lý phù hợp cho hành khách này.</div>
                      )}
                      {!ancillaryLoading && !ancillaryError && !skipBaggage && routeOptions.length > 0 && (
                        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                          {routeOptions.map((route) => {
                            const selected = passenger.listLuggage.find(
                              (item) => item.route === route.route && Number(item.segmentId || 0) === Number(route.segmentId || 0)
                            );
                            return (
                              <label key={`${route.route}-${route.segmentId}`} className="block text-xs text-[#7a6a52]">
                                {routeCodeLabel(airports, route.route)} {route.airline ? `(${route.airline})` : ''}
                                <select
                                  className="mt-1 w-full rounded px-2 py-2 text-sm focus:outline-none"
                                  style={{ border: '1px solid #e8dcc8' }}
                                  value={selected?.key || ''}
                                  onChange={(e) => updatePassengerLuggage(
                                    index,
                                    route.route,
                                    Number(route.segmentId || 0),
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
                  </div>
                </div>
              );
            })}
          </div>

              <div className="apg-panel px-4 py-4">
                <div className="apg-eyebrow">Thông tin liên hệ</div>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="text-xs font-semibold text-[#7a6a52]">
                    Điện thoại *
                    <input
                      type="tel"
                      className="apg-field mt-1 px-3 text-sm"
                      style={{ border: '1px solid #e8dcc8' }}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0918752686"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#7a6a52]">
                    Email *
                    <input
                      type="email"
                      className="apg-field mt-1 px-3 text-sm"
                      style={{ border: '1px solid #e8dcc8' }}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="khachhang@example.com"
                    />
                  </label>
                </div>

                <label className="mt-3 flex items-start gap-2 rounded-[var(--apg-radius-md)] border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
                  <input type="checkbox" className="mt-0.5" checked={createRealHold} onChange={(e) => setCreateRealHold(e.target.checked)} />
                  <span>Tôi xác nhận tạo PNR giữ chỗ thật. Nếu không tick, hệ thống chỉ kiểm tra thử payload.</span>
                </label>
              </div>

              <div className="mt-3 space-y-3 lg:hidden">
                {progressBlock}
                {errorBlock}
                {resultBlock}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--apg-border-default)] px-4 py-3 lg:px-5 lg:sticky lg:bottom-0 lg:bg-white">
          <button className="apg-btn-secondary flex-1 text-sm font-semibold text-[var(--apg-aviation-navy)]" onClick={onClose}>
            Đóng
          </button>
          <button
            className={`${createRealHold ? 'apg-btn-danger' : 'apg-btn-primary'} flex-1 text-sm font-bold text-white disabled:opacity-60`}
            onClick={submitHold}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : createRealHold ? 'Tạo PNR thật' : 'Kiểm tra thử'}
          </button>
        </div>
      </div>
    </div>
  );
}
