// Trích hành trình + hành khách từ bản ghi booking (namthanhRawJson + pnrs).
// Dùng chung cho trang thanh toán và API tra cứu đơn để không lệch logic.

export interface QuoteLeg {
  legKey?: string;
  route?: string;
  airline?: string;
  cabin?: string;
  fareClass?: string;
  departureAt?: string;
  arrivalAt?: string;
  domesticInternational?: string;
}

interface HoldFlightSegment {
  flightNo?: string;
  flightNumber?: string;
  number?: string;
  airline?: string;
  from?: string;
  to?: string;
  departureAt?: string;
  arrivalAt?: string;
  cabin?: string;
}

interface HoldFlight {
  id?: string;
  airline?: string;
  flightNo?: string;
  flightNumber?: string;
  segments?: HoldFlightSegment[];
}

export interface NamThanhRaw {
  quote?: { legs?: QuoteLeg[] };
  request?: {
    contact?: { fullName?: string; phone?: string; email?: string };
    passengers?: { firstName?: string; lastName?: string; type?: string; dob?: string }[];
  };
  holdResult?: {
    flight?: HoldFlight;
    legs?: { outbound?: { flight?: HoldFlight }; inbound?: { flight?: HoldFlight } };
  };
}

export interface PaymentItineraryLeg {
  legKey: string;
  legLabel: string;
  airline: string | null;
  flightNumber: string | null;
  route: string;
  from: string | null;
  to: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  cabin: string | null;
  pnr: string | null;
  pnrStatus: string | null;
  pnrTimelimit: string | null;
}

export interface TicketViewPassenger {
  type: string;
  firstName: string;
  lastName: string;
}

interface BookingPnrLike {
  airline: string | null;
  pnr: string;
  status: string | null;
  routeSummary: string | null;
  departAt: Date | null;
  timelimit: Date | null;
}

interface BookingViewInput {
  namthanhRawJson: unknown;
  pnrs: BookingPnrLike[];
}

function pickFlightNumber(flight?: HoldFlight): string | null {
  if (!flight) return null;
  const direct = flight.flightNo || flight.flightNumber;
  if (direct) return direct;
  const seg = flight.segments?.[0];
  if (seg) return seg.flightNo || seg.flightNumber || seg.number || null;
  return null;
}

export function buildTicketView(booking: BookingViewInput): {
  itinerary: PaymentItineraryLeg[];
  passengers: TicketViewPassenger[];
} {
  const raw = (booking.namthanhRawJson ?? null) as NamThanhRaw | null;
  const quoteLegs = raw?.quote?.legs ?? [];
  const holdLegOutbound = raw?.holdResult?.legs?.outbound?.flight ?? raw?.holdResult?.flight;
  const holdLegInbound = raw?.holdResult?.legs?.inbound?.flight;

  const findHoldFlight = (legKey: string | undefined): HoldFlight | undefined => {
    if (legKey === "inbound") return holdLegInbound;
    return holdLegOutbound;
  };

  const findPnrByLeg = (route: string | null) => {
    if (!route) return booking.pnrs[0] ?? null;
    return booking.pnrs.find((p) => (p.routeSummary || "").toUpperCase() === route.toUpperCase()) ?? null;
  };

  const itinerary: PaymentItineraryLeg[] = quoteLegs.length
    ? quoteLegs.map((leg, idx) => {
        const route = leg.route ?? null;
        const [from, to] = route ? route.split("-") : [null, null];
        const holdFlight = findHoldFlight(leg.legKey);
        const matchingPnr = findPnrByLeg(route);
        return {
          legKey: leg.legKey || `leg-${idx}`,
          legLabel: leg.legKey === "inbound" ? "Chiều về" : "Chiều đi",
          airline: leg.airline ?? null,
          flightNumber: pickFlightNumber(holdFlight),
          route: route ?? "",
          from: from ?? null,
          to: to ?? null,
          departureAt: leg.departureAt ?? null,
          arrivalAt: leg.arrivalAt ?? null,
          cabin: leg.fareClass || leg.cabin || null,
          pnr: matchingPnr?.pnr ?? null,
          pnrStatus: matchingPnr?.status ?? null,
          pnrTimelimit: matchingPnr?.timelimit?.toISOString() ?? null,
        };
      })
    : booking.pnrs.map((p, idx) => {
        const [from, to] = (p.routeSummary || "").split("-");
        return {
          legKey: `pnr-${idx}`,
          legLabel: idx === 0 ? "Chiều đi" : "Chiều về",
          airline: p.airline ?? null,
          flightNumber: null,
          route: p.routeSummary ?? "",
          from: from ?? null,
          to: to ?? null,
          departureAt: p.departAt?.toISOString() ?? null,
          arrivalAt: null,
          cabin: null,
          pnr: p.pnr,
          pnrStatus: p.status,
          pnrTimelimit: p.timelimit?.toISOString() ?? null,
        };
      });

  const passengers: TicketViewPassenger[] = (raw?.request?.passengers ?? []).map((p) => ({
    type: p.type ?? "ADT",
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
  }));

  return { itinerary, passengers };
}
