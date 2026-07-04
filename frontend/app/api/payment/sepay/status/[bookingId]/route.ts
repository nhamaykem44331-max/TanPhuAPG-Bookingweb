import { NextResponse } from "next/server";

import { calculatePaymentSummary } from "@/lib/booking/paymentSummary";
import { prisma } from "@/lib/db";
import { PaymentIntentProvider, PaymentIntentStatus } from "@prisma/client";
import { syncExpiredSepayIntentsForBooking } from "@/lib/payments/sepayService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Polling endpoint — frontend gọi mỗi 3-5s để check trạng thái thanh toán.
 *
 * Trả:
 *  - status: "PENDING" | "PAID" | "PARTIAL" | "EXPIRED" | "CANCELLED"
 *  - balance: số tiền còn lại
 *  - bookingStatus: HELD | TICKETED | EXPIRED | ...
 *  - intent: thông tin QR đang có hiệu lực (nếu còn)
 */
export async function GET(_: Request, context: { params: { bookingId: string } }) {
  const bookingId = context.params.bookingId?.trim();

  if (!bookingId) {
    return NextResponse.json({ error: "BOOKING_ID_REQUIRED" }, { status: 400 });
  }

  // Auto-expire các intent đã quá hạn trước khi trả về
  await syncExpiredSepayIntentsForBooking(bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      orderCode: true,
      status: true,
      saleAmount: true,
      currency: true,
      ttlExpiresAt: true,
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
    return NextResponse.json({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const summary = calculatePaymentSummary(booking.payments, booking.saleAmount);
  const intent = booking.paymentIntents[0] ?? null;

  // Tổng hợp trạng thái thanh toán cuối cùng cho UI
  let paymentStatus: PaymentIntentStatus | "NONE" = "NONE";

  if (intent) {
    paymentStatus = intent.status;
  } else if (summary.balance <= 0 && summary.totalPaid > 0) {
    paymentStatus = PaymentIntentStatus.PAID;
  }

  return NextResponse.json({
    bookingId: booking.id,
    orderCode: booking.orderCode,
    bookingStatus: booking.status,
    ttlExpiresAt: booking.ttlExpiresAt,
    saleAmount: booking.saleAmount,
    totalPaid: summary.totalPaid,
    balance: summary.balance,
    currency: booking.currency,
    paymentStatus,
    intent: intent
      ? {
          id: intent.id,
          providerOrderCode: intent.providerOrderCode,
          amount: intent.amount,
          currency: intent.currency,
          status: intent.status,
          qrCode: intent.qrCode,
          accountNumber: intent.accountNumber,
          accountName: intent.accountName,
          bankCode: intent.bin,
          transferContent: intent.transferContent,
          expiresAt: intent.expiresAt,
          paidAt: intent.paidAt,
        }
      : null,
  });
}
