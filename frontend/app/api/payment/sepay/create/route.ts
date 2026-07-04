import { NextResponse } from "next/server";

import { createSepayIntentForBooking, SepayError } from "@/lib/payments/sepayService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public B2C endpoint — gọi từ trang /booking/payment/[bookingId].
 *
 * Body: { bookingId: string }
 *
 * Bảo mật: bookingId là cuid khó đoán; chỉ trả về intent của đúng booking.
 * Không yêu cầu auth admin để khách lẻ gọi được.
 */
export async function POST(request: Request) {
  let body: { bookingId?: string };

  try {
    body = (await request.json()) as { bookingId?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const bookingId = body?.bookingId?.trim();

  if (!bookingId) {
    return NextResponse.json({ error: "BOOKING_ID_REQUIRED" }, { status: 400 });
  }

  try {
    // actorId=null vì khách lẻ không có user session
    const result = await createSepayIntentForBooking(bookingId, null);

    return NextResponse.json(
      {
        reused: result.reused,
        intent: {
          id: result.intent.id,
          providerOrderCode: result.intent.providerOrderCode,
          amount: result.intent.amount,
          currency: result.intent.currency,
          status: result.intent.status,
          qrCode: result.intent.qrCode,
          accountNumber: result.intent.accountNumber,
          accountName: result.intent.accountName,
          bankCode: result.intent.bin, // bank code lưu vào field bin
          transferContent: result.intent.transferContent,
          expiresAt: result.intent.expiresAt,
        },
      },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof SepayError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    console.error("[sepay/create] failed", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Không tạo được QR thanh toán." },
      { status: 500 },
    );
  }
}
