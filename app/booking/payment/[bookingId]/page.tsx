import { notFound } from "next/navigation";
import { PaymentIntentProvider } from "@prisma/client";

import { prisma } from "@/lib/db";

import { SepayPaymentClient } from "./SepayPaymentClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { bookingId: string };
}

interface QuoteLeg {
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

interface NamThanhRaw {
  quote?: { legs?: QuoteLeg[] };
  request?: {
    contact?: { fullName?: string; phone?: string; email?: string };
    passengers?: { firstName?: string; lastName?: string; type?: string }[];
  };
  holdResult?: {
    flight?: HoldFlight;
    legs?: { outbound?: { flight?: HoldFlight }; inbound?: { flight?: HoldFlight } };
  };
}

/** Parse số chuyến từ flight.id dạng "VU_HANSGN_2000_2210" → "VU 787" không có trong data, trả null */
function pickFlightNumber(flight?: HoldFlight): string | null {
  if (!flight) return null;
  // Field ưu tiên
  const direct = flight.flightNo || flight.flightNumber;
  if (direct) return direct;
  // Lấy từ segments[0]
  const seg = flight.segments?.[0];
  if (seg) return seg.flightNo || seg.flightNumber || seg.number || null;
  return null;
}

interface PaymentItineraryLeg {
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

export default async function BookingPaymentPage({ params }: PageProps) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      orderCode: true,
      sessionId: true,
      status: true,
      saleAmount: true,
      currency: true,
      airline: true,
      routeSummary: true,
      departAt: true,
      returnAt: true,
      ttlExpiresAt: true,
      pnr: true,
      tripType: true,
      adt: true,
      chd: true,
      inf: true,
      namthanhRawJson: true,
      customer: {
        select: { fullName: true, phone: true, email: true },
      },
      pnrs: {
        orderBy: { createdAt: "asc" },
        select: {
          airline: true,
          pnr: true,
          status: true,
          routeSummary: true,
          departAt: true,
          timelimit: true,
        },
      },
      payments: { select: { amount: true, status: true } },
      paymentIntents: {
        where: { provider: PaymentIntentProvider.SEPAY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          providerOrderCode: true,
          amount: true,
          currency: true,
          status: true,
          qrCode: true,
          accountNumber: true,
          accountName: true,
          bin: true,
          transferContent: true,
          expiresAt: true,
          paidAt: true,
        },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  const totalPaid = booking.payments
    .filter((p) => p.status === "PAID" || p.status === "PARTIAL")
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(booking.saleAmount - totalPaid, 0);
  const initialIntent = booking.paymentIntents[0] ?? null;

  // ----- Build itinerary legs từ namthanhRawJson + pnrs -----
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
    return (
      booking.pnrs.find((p) => (p.routeSummary || "").toUpperCase() === route.toUpperCase()) ?? null
    );
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

  return (
    <SepayPaymentClient
      booking={{
        id: booking.id,
        orderCode: booking.orderCode,
        sessionId: booking.sessionId,
        status: booking.status,
        saleAmount: booking.saleAmount,
        currency: booking.currency,
        airline: booking.airline,
        routeSummary: booking.routeSummary,
        departAt: booking.departAt?.toISOString() ?? null,
        returnAt: booking.returnAt?.toISOString() ?? null,
        pnr: booking.pnr,
        tripType: booking.tripType,
        adt: booking.adt,
        chd: booking.chd,
        inf: booking.inf,
        ttlExpiresAt: booking.ttlExpiresAt?.toISOString() ?? null,
        customer: booking.customer,
        balance,
        totalPaid,
        itinerary,
      }}
      initialIntent={
        initialIntent
          ? {
              id: initialIntent.id,
              providerOrderCode: initialIntent.providerOrderCode,
              amount: initialIntent.amount,
              currency: initialIntent.currency,
              status: initialIntent.status,
              qrCode: initialIntent.qrCode,
              accountNumber: initialIntent.accountNumber,
              accountName: initialIntent.accountName,
              bankCode: initialIntent.bin,
              transferContent: initialIntent.transferContent,
              expiresAt: initialIntent.expiresAt?.toISOString() ?? null,
              paidAt: initialIntent.paidAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
