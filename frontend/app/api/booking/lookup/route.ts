import { NextResponse } from "next/server";
import { PaymentIntentProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { buildTicketView } from "@/lib/booking/ticketView";
import { getLoginRateLimitStatus, recordLoginFailure } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Tra cứu đơn công khai bằng mã đơn + 4 số cuối SĐT.
 * Rate-limit theo IP để chống dò. Không tiết lộ đơn có tồn tại hay không khi sai.
 */
export async function POST(request: Request) {
  const bucket = `booking-lookup:${clientIp(request)}`;
  const status = await getLoginRateLimitStatus(bucket);
  if (!status.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterSeconds: status.retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: { orderCode?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const orderCode = (body.orderCode || "").trim().toUpperCase();
  const phoneDigits = onlyDigits(body.phone || "");
  if (!orderCode || phoneDigits.length < 4) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { orderCode },
    select: {
      id: true,
      orderCode: true,
      status: true,
      saleAmount: true,
      currency: true,
      routeSummary: true,
      tripType: true,
      pnr: true,
      ttlExpiresAt: true,
      paidConfirmedAt: true,
      namthanhRawJson: true,
      customer: { select: { fullName: true, phone: true, email: true } },
      pnrs: {
        orderBy: { createdAt: "asc" },
        select: { airline: true, pnr: true, status: true, routeSummary: true, departAt: true, timelimit: true },
      },
      payments: { select: { amount: true, status: true } },
      paymentIntents: {
        where: { provider: PaymentIntentProvider.SEPAY },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          amount: true,
          accountNumber: true,
          accountName: true,
          bin: true,
          transferContent: true,
          qrCode: true,
          paidAt: true,
        },
      },
    },
  });

  const custPhone = onlyDigits(booking?.customer?.phone || "");
  const matches = Boolean(booking && custPhone.length >= 4 && custPhone.slice(-4) === phoneDigits.slice(-4));

  if (!booking || !matches) {
    await recordLoginFailure(bucket);
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const summary = calculatePaymentSummary(booking.payments, booking.saleAmount);
  const { itinerary, passengers } = buildTicketView(booking);
  const intent = booking.paymentIntents[0] ?? null;

  return NextResponse.json({
    bookingId: booking.id,
    orderCode: booking.orderCode,
    bookingStatus: booking.status,
    tripType: booking.tripType,
    routeSummary: booking.routeSummary,
    saleAmount: booking.saleAmount,
    currency: booking.currency,
    totalPaid: summary.totalPaid,
    balance: summary.balance,
    ttlExpiresAt: booking.ttlExpiresAt?.toISOString() ?? null,
    paidAtIso: intent?.paidAt?.toISOString() ?? booking.paidConfirmedAt?.toISOString() ?? null,
    pnr: booking.pnr,
    customerName: booking.customer?.fullName ?? null,
    customerEmail: booking.customer?.email ?? null,
    itinerary,
    passengers,
    intent: intent
      ? {
          amount: intent.amount,
          bankCode: intent.bin,
          accountNumber: intent.accountNumber,
          accountName: intent.accountName,
          transferContent: intent.transferContent,
          qrCode: intent.qrCode,
        }
      : null,
  });
}
