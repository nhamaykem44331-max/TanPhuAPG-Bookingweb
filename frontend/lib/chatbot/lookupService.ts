// Tra cứu đơn cho chatbot — dùng lại logic của /api/booking/lookup nhưng gọi in-process
// và trả về tập thông tin an toàn cho bot. KHÁC route công khai ở chỗ:
//   - Rate-limit theo hội thoại (tầng engine), KHÔNG theo IP (bot 1 IP sẽ khoá chéo khách).
//   - KHÔNG trả email khách (bot không chủ động đọc email ra hội thoại).
//   - KHÔNG trả bất kỳ dữ liệu net/nhà cung cấp nào.
// Xác thực sở hữu vẫn giữ nguyên: mã đơn + 4 số cuối SĐT.

import { PaymentIntentProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { buildTicketView } from "@/lib/booking/ticketView";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export type ChatBookingLookup =
  | { found: false }
  | {
      found: true;
      bookingId: string;
      orderCode: string;
      status: string;
      tripType: string | null;
      routeSummary: string | null;
      saleAmount: number;
      currency: string;
      totalPaid: number;
      balance: number;
      ttlExpiresAt: string | null;
      paidAtIso: string | null;
      pnr: string | null;
      customerName: string | null;
      itinerary: ReturnType<typeof buildTicketView>["itinerary"];
      passengers: ReturnType<typeof buildTicketView>["passengers"];
      payment: {
        amount: number;
        bankCode: string | null;
        accountNumber: string | null;
        accountName: string | null;
        transferContent: string | null;
      } | null;
    };

/**
 * Tra cứu đơn bằng mã đơn + SĐT (khớp 4 số cuối). Trả { found: false } cho cả
 * "không có đơn" lẫn "sai SĐT" — bot dùng câu chung "mã đơn và SĐT không khớp".
 */
export async function lookupBookingForChat(
  orderCodeInput: string,
  phoneInput: string,
): Promise<ChatBookingLookup> {
  const orderCode = (orderCodeInput || "").trim().toUpperCase();
  const phoneDigits = onlyDigits(phoneInput || "");
  if (!orderCode || phoneDigits.length < 4) return { found: false };

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
      customer: { select: { fullName: true, phone: true } },
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
          paidAt: true,
        },
      },
    },
  });

  const custPhone = onlyDigits(booking?.customer?.phone || "");
  const matches = Boolean(
    booking && custPhone.length >= 4 && custPhone.slice(-4) === phoneDigits.slice(-4),
  );
  if (!booking || !matches) return { found: false };

  const summary = calculatePaymentSummary(booking.payments, booking.saleAmount);
  const { itinerary, passengers } = buildTicketView(booking);
  const intent = booking.paymentIntents[0] ?? null;

  return {
    found: true,
    bookingId: booking.id,
    orderCode: booking.orderCode,
    status: booking.status,
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
    itinerary,
    passengers,
    payment: intent
      ? {
          amount: intent.amount,
          bankCode: intent.bin,
          accountNumber: intent.accountNumber,
          accountName: intent.accountName,
          transferContent: intent.transferContent,
        }
      : null,
  };
}
