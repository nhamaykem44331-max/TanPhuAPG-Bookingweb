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

    const baseContext = {
      bookingId: result.bookingId ?? null,
      orderCode: result.orderCode ?? null,
      pnr: result.pnr ?? null,
      reason: result.reason ?? null,
      sepayTxnId: payload.id,
      bankTransactionId: result.bankTransaction?.id ?? null,
      paymentIntentId: result.paymentIntent?.id ?? null,
      paymentId: result.payment?.id ?? null,
      transferredAmount: result.transferredAmount ?? null,
      remainingAmount: result.remainingAmount ?? null,
    };

    if (result.kind === "matched") {
      void notify({
        type: "INTERNAL_ALERT",
        severity: result.remainingAmount && result.remainingAmount > 0 ? "warn" : "info",
        message:
          result.remainingAmount && result.remainingAmount > 0
            ? `SePay ghi nhận thanh toán một phần cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "booking"}`
            : `SePay đã match thanh toán cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "booking"}`,
        context: baseContext,
      });
    } else if (result.kind === "manual_review") {
      void notify({
        type: "INTERNAL_ALERT",
        severity: "warn",
        message: `SePay cần manual review cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "giao dịch chưa rõ booking"} (${result.reason ?? "unknown"})`,
        context: baseContext,
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
