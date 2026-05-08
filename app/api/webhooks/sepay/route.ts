import { NextResponse } from "next/server";

import { notify } from "@/lib/notifications";
import {
  extractClientIp,
  isSepayIpAllowed,
  verifySepayAuth,
  type SepayWebhookPayload,
} from "@/lib/payments/providers/sepay";
import { handleSepayWebhook } from "@/lib/payments/sepayService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook biến động số dư từ SePay.
 *
 * Yêu cầu trên SePay dashboard:
 *  - URL: https://<your-domain>/api/webhooks/sepay
 *  - Sự kiện: "Có tiền vào"
 *  - Chứng thực: "API Key"
 *      Header: Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
 *
 * SePay yêu cầu phản hồi 200/201 với body { success: true } để đánh dấu đã giao.
 */
export async function POST(request: Request) {
  // 1. IP whitelist check
  const clientIp = extractClientIp(request.headers);

  if (!isSepayIpAllowed(clientIp)) {
    console.warn("[sepay/webhook] rejected non-whitelisted IP", clientIp);
    return NextResponse.json(
      { success: false, error: "IP_NOT_ALLOWED" },
      { status: 403 },
    );
  }

  // 2. Auth header check
  if (!verifySepayAuth(request.headers)) {
    return NextResponse.json(
      { success: false, error: "INVALID_AUTH" },
      { status: 401 },
    );
  }

  // 3. Parse payload
  let payload: SepayWebhookPayload;

  try {
    payload = (await request.json()) as SepayWebhookPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return NextResponse.json(
      { success: false, error: "MISSING_FIELDS" },
      { status: 400 },
    );
  }

  // 4. Xử lý
  try {
    const result = await handleSepayWebhook(payload);

    if (result.kind === "matched") {
      if (result.bookingId && !(result.remainingAmount && result.remainingAmount > 0)) {
        void notify({
          type: "SEPAY_PAYMENT_MATCHED",
          bookingId: result.bookingId,
          paymentIntentId: result.paymentIntent?.id ?? null,
          paymentId: result.payment?.id ?? null,
          bankTransactionId: result.bankTransaction?.id ?? null,
          transferredAmount: result.transferredAmount ?? null,
          remainingAmount: result.remainingAmount ?? null,
        });
      } else {
        void notify({
          type: "SEPAY_PAYMENT_REVIEW",
          bookingId: result.bookingId ?? null,
          paymentIntentId: result.paymentIntent?.id ?? null,
          paymentId: result.payment?.id ?? null,
          bankTransactionId: result.bankTransaction?.id ?? null,
          reason: result.reason ?? "PARTIAL_PAYMENT",
          transferredAmount: result.transferredAmount ?? null,
          remainingAmount: result.remainingAmount ?? null,
        });
      }
    } else if (result.kind === "manual_review") {
      void notify({
        type: "SEPAY_PAYMENT_REVIEW",
        bookingId: result.bookingId ?? null,
        paymentIntentId: result.paymentIntent?.id ?? null,
        paymentId: result.payment?.id ?? null,
        bankTransactionId: result.bankTransaction?.id ?? null,
        reason: result.reason ?? null,
        transferredAmount: result.transferredAmount ?? null,
        remainingAmount: result.remainingAmount ?? null,
      });
    }

    // SePay yêu cầu success:true để đánh dấu đã giao webhook
    return NextResponse.json(
      {
        success: true,
        kind: result.kind,
        reason: result.reason ?? null,
        bankTransactionId: result.bankTransaction?.id ?? null,
        paymentIntentId: result.paymentIntent?.id ?? null,
        paymentId: result.payment?.id ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[sepay/webhook] handler failed", error);

    // Trả 500 để SePay tự retry (theo docs)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Webhook SePay xử lý thất bại.",
      },
      { status: 500 },
    );
  }
}
