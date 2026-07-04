import type { FlightResult } from './types';

export type FlightBadgeTone = 'cheapest' | 'business' | 'carryOn' | 'checked' | 'fareClass' | 'seats';

export interface FlightBadge {
  key: 'cheapest' | 'business' | 'carryOn' | 'checked' | 'fareClass' | 'seats';
  label: string;
  tone: FlightBadgeTone;
}

type FareMetadata = {
  carryOnText?: string;
  checkedBaggageText?: string;
  fareFamily?: string;
  isBusiness?: boolean;
  class?: string;
  cabinClass?: string;
  fareBasis?: string;
  seatAvailable?: number;
};

function cleanText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function selectedFareMetadata(flight: FlightResult): FareMetadata {
  const fareId = cleanText(flight.fareId || flight.namthanh?.fareId);
  const total = Number(flight.fareBreakdown?.totalAmount ?? flight.price.amount ?? 0);
  const selectedFare = (flight.fareOptions || []).find((fare) => {
    if (fareId && fare.id === fareId) return true;
    const fareTotal = Number(fare.fareBreakdown?.totalAmount ?? fare.totalAmount ?? 0);
    return fareTotal > 0 && Math.abs(fareTotal - total) < 1;
  });

  return {
    carryOnText: cleanText(selectedFare?.carryOnText || flight.namthanh?.carryOnText),
    checkedBaggageText: cleanText(selectedFare?.checkedBaggageText || flight.namthanh?.checkedBaggageText),
    fareFamily: cleanText(selectedFare?.fareFamily || flight.namthanh?.fareFamily),
    isBusiness: Boolean(selectedFare?.isBusiness || flight.namthanh?.isBusiness),
    class: cleanText(selectedFare?.class || flight.namthanh?.class),
    cabinClass: cleanText(selectedFare?.cabinClass || flight.namthanh?.cabinClass),
    fareBasis: cleanText(selectedFare?.fareBasis || flight.namthanh?.fareBasis),
    seatAvailable: Number(selectedFare?.seatAvailable ?? flight.namthanh?.seatAvailable ?? 0),
  };
}

// Nhãn hạng vé thân thiện — chỉ dựa trên dữ liệu thật (economy/business).
function friendlyFareClass(meta: FareMetadata): string {
  return isBusinessFare(meta) ? 'Thương gia' : 'Phổ thông';
}

function isBusinessFare(meta: FareMetadata): boolean {
  if (meta.isBusiness) return true;
  const haystack = [
    meta.fareFamily,
    meta.cabinClass,
    meta.fareBasis,
    meta.class,
  ].join(' ').toLowerCase();

  if (/\bbusiness\b|sky\s*boss|c[_\s-]*boss/.test(haystack)) return true;

  // Chỉ dùng class code khi không có cabin/family rõ ràng để tránh gắn nhầm Economy.
  const fareClass = cleanText(meta.class).toUpperCase();
  return ['C', 'J', 'D', 'I'].includes(fareClass);
}

function formatBaggageLabel(prefix: string, value: string): string {
  const text = cleanText(value);
  if (!text) return '';
  if (text.toLowerCase().startsWith(prefix.toLowerCase())) return text;
  return `${prefix} ${text}`;
}

export function flightTotalAmount(flight: FlightResult): number {
  return Number(flight.fareBreakdown?.totalAmount ?? flight.price.amount ?? 0);
}

export function minFlightPrice(flights: FlightResult[]): number | null {
  const prices = flights
    .map((flight) => flightTotalAmount(flight))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

export function buildFlightBadges(flight: FlightResult, dailyMinPrice?: number | null): FlightBadge[] {
  const badges: FlightBadge[] = [];
  const total = flightTotalAmount(flight);
  const meta = selectedFareMetadata(flight);

  if (dailyMinPrice != null && Number.isFinite(dailyMinPrice) && total > 0 && Math.abs(total - dailyMinPrice) < 1) {
    badges.push({ key: 'cheapest', label: 'Rẻ nhất', tone: 'cheapest' });
  }

  if (isBusinessFare(meta)) {
    badges.push({ key: 'business', label: 'Business', tone: 'business' });
  }

  const carryOnLabel = formatBaggageLabel('Xách tay', meta.carryOnText || '');
  if (carryOnLabel) {
    badges.push({ key: 'carryOn', label: carryOnLabel, tone: 'carryOn' });
  }

  const checkedLabel = formatBaggageLabel('Ký gửi', meta.checkedBaggageText || '');
  if (checkedLabel) {
    badges.push({ key: 'checked', label: checkedLabel, tone: 'checked' });
  }

  return badges;
}

// Badge điều kiện vé hiển thị trên MỌI thẻ chuyến (để so sánh trước khi chọn):
// hạng vé + hành lý (chỉ khi có dữ liệu thật) + số ghế còn (thật). KHÔNG bịa số hành lý.
export function buildFlightConditionBadges(flight: FlightResult, dailyMinPrice?: number | null): FlightBadge[] {
  const meta = selectedFareMetadata(flight);
  const badges: FlightBadge[] = [
    { key: 'fareClass', label: friendlyFareClass(meta), tone: 'fareClass' },
    ...buildFlightBadges(flight, dailyMinPrice),
  ];
  const seats = Number(meta.seatAvailable ?? 0);
  if (seats > 0 && seats <= 9) {
    badges.push({ key: 'seats', label: `Còn ${seats} chỗ`, tone: 'seats' });
  }
  return badges;
}
