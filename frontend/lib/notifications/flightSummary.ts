// Tóm tắt hành trình cho thông báo (email khách + Telegram/Zalo nhân sự).
// Đọc itinerary đã lưu (extractItinerary) → tên hãng + số hiệu + ngày + giờ đi/đến từng chặng.
//
// Lưu ý múi giờ: các mốc giờ trong itinerary được lưu dạng INSTANT thật (toIso đã gắn +07:00
// khi tạo, ví dụ chuyến 05:45 VN lưu 22:45Z hôm trước). Vì vậy PHẢI format ở "Asia/Ho_Chi_Minh"
// để ra đúng giờ bay Việt Nam; nếu dùng "UTC" sẽ lệch −7h và có thể sai cả ngày.
import { getAirlineMeta } from "@/lib/airlines";
import { extractItinerary, type ItinerarySourceBooking } from "@/lib/bookings/itinerary";

export interface FlightLegSummary {
  label: string; // "Chiều đi" | "Chiều về"
  direction: "outbound" | "inbound";
  airline: string; // tên hãng đã chuẩn hóa, vd "Vietjet Air"
  flightNumber: string | null; // "VJ163" (nối chặng: "VJ163, VJ1614")
  route: string; // "HAN → SGN"
  departTime: string | null; // "13:30"
  arriveTime: string | null; // "15:40"
  dateLabel: string | null; // "09/07/2026"
}

function fmt(iso: string | null, opts: Intl.DateTimeFormatOptions): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", ...opts }).format(date);
}

export function buildFlightLegSummaries(booking: ItinerarySourceBooking): FlightLegSummary[] {
  const itinerary = extractItinerary(booking);
  if (!itinerary) {
    return [];
  }

  return itinerary.legs.map((leg) => {
    const meta = getAirlineMeta(leg.airlineCode ?? undefined, leg.airline ?? undefined);
    const flightNumbers = leg.segments
      .map((seg) => seg.flightNumber)
      .filter((value): value is string => Boolean(value));
    const departIso = leg.departAt ?? leg.segments[0]?.departAt ?? null;
    const lastSegment = leg.segments[leg.segments.length - 1];
    const arriveIso = leg.arrivalAt ?? lastSegment?.arrivalAt ?? null;
    const [from, to] = leg.route.split("-");

    return {
      label: leg.direction === "inbound" ? "Chiều về" : "Chiều đi",
      direction: leg.direction,
      airline: meta.name || meta.code,
      flightNumber: flightNumbers.length > 0 ? flightNumbers.join(", ") : null,
      route: [from, to].filter(Boolean).join(" → "),
      departTime: fmt(departIso, { hour: "2-digit", minute: "2-digit", hour12: false }),
      arriveTime: fmt(arriveIso, { hour: "2-digit", minute: "2-digit", hour12: false }),
      dateLabel: fmt(departIso, { day: "2-digit", month: "2-digit", year: "numeric" }),
    } satisfies FlightLegSummary;
  });
}

export interface PassengerSummary {
  name: string; // "NGUYEN TO HOAN" (Họ + Tên)
  typeLabel: string; // "Người lớn" | "Trẻ em" | "Em bé"
}

const PAX_TYPE_LABEL: Record<string, string> = {
  ADT: "Người lớn",
  CHD: "Trẻ em",
  INF: "Em bé",
};

/** Danh sách hành khách từ namthanhRawJson.request.passengers (đủ mọi khách, không chỉ người đặt). */
export function buildPassengerSummaries(booking: { namthanhRawJson: unknown }): PassengerSummary[] {
  const raw = booking.namthanhRawJson;
  const request = raw && typeof raw === "object" ? (raw as Record<string, unknown>).request : null;
  const list = request && typeof request === "object" ? (request as Record<string, unknown>).passengers : null;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item) => {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const last = String(rec.lastName ?? "").trim();
    const first = String(rec.firstName ?? "").trim();
    const name = [last, first].filter(Boolean).join(" ") || String(rec.fullName ?? rec.name ?? "").trim();
    const type = String(rec.type ?? "ADT").toUpperCase();
    return { name: name || "(chưa có tên)", typeLabel: PAX_TYPE_LABEL[type] ?? type };
  });
}

/** Dòng danh sách hành khách cho Telegram/Zalo/email text. */
export function passengerLines(passengers: PassengerSummary[]): string[] {
  return passengers.map((pax, index) => `${index + 1}. ${pax.name} — ${pax.typeLabel}`);
}

/** Dòng chữ thuần cho Telegram/Zalo + phần text fallback của email. */
export function flightLegLines(legs: FlightLegSummary[]): string[] {
  return legs.map((leg) => {
    const timeRange = leg.departTime
      ? `${leg.departTime}${leg.arriveTime ? `–${leg.arriveTime}` : ""}`
      : null;
    const detail = [
      leg.airline,
      leg.flightNumber ? `chuyến ${leg.flightNumber}` : null,
      leg.dateLabel,
      timeRange,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${leg.label}: ${leg.route}${detail ? ` — ${detail}` : ""}`;
  });
}
