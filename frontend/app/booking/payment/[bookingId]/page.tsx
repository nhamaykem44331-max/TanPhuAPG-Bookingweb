import { notFound } from "next/navigation";
import { PaymentIntentProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildTicketView } from "@/lib/booking/ticketView";

import { SepayPaymentClient } from "./SepayPaymentClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { bookingId: string };
  searchParams?: { later?: string };
}

export default async function BookingPaymentPage({ params, searchParams }: PageProps) {
  const payLater = searchParams?.later === "1";
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

  // Hành trình + hành khách dựng từ namthanhRawJson + pnrs (dùng chung với API tra cứu).
  const { itinerary, passengers } = buildTicketView(booking);

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
        passengers,
      }}
      payLater={payLater}
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
