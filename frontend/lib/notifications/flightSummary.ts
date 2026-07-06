// Tóm tắt hành trình cho thông báo (email khách + Telegram/Zalo nhân sự).
// Đọc itinerary đã lưu (extractItinerary) → tên hãng + số hiệu + ngày + giờ đi/đến từng chặng.
//
// Lưu ý múi giờ: các mốc giờ trong itinerary được lưu dạng "wall-clock as UTC"
// (giống booking.departAt mà formatDate hiện dùng), nên PHẢI format ở timeZone "UTC"
// để ra đúng giờ Việt Nam đang hiển thị (13:30), không dùng Asia/Ho_Chi_Minh (lệch +7h).
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
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", ...opts }).format(date);
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
