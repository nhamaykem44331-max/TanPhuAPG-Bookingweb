import type { Webhook } from "@payos/node";
import { NextResponse } from "next/server";

import { notify } from "@/lib/notifications";
import { handlePayOSWebhook } from "@/lib/payments/paymentIntentService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Webhook;

  try {
    body = (await request.json()) as Webhook;
  } catch {
    return NextResponse.json({ error: -1, message: "Body webhook không hợp lệ.", data: null }, { status: 400 });
  }

  try {
    const result = await handlePayOSWebhook(body);
    const baseContext = {
      bookingId: result.bookingId ?? null,
      orderCode: result.orderCode ?? null,
      pnr: result.pnr ?? null,
      reason: result.reason ?? null,
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
            ? `payOS ghi nhận thanh toán một phần cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "booking"}`
            : `payOS đã match thanh toán cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "booking"}`,
        context: baseContext,
      });
    } else if (result.kind === "manual_review") {
      void notify({
        type: "INTERNAL_ALERT",
        severity: "warn",
        message: `payOS cần manual review cho ${result.orderCode ?? result.pnr ?? result.bookingId ?? "giao dịch chưa rõ booking"}`,
        context: baseContext,
      });
    }

    return NextResponse.json({
      error: 0,
      message: "Webhook delivered",
      data: {
        kind: result.kind,
        reason: result.reason ?? null,
        bankTransactionId: result.bankTransaction?.id ?? null,
        paymentIntentId: result.paymentIntent?.id ?? null,
        paymentId: result.payment?.id ?? null,
      },
    });
  } catch (error) {
    console.error("payOS webhook failed", error);

    return NextResponse.json(
      {
        error: -1,
        message: error instanceof Error ? error.message : "Webhook payOS xử lý thất bại.",
        data: null,
      },
      { status: 400 },
    );
  }
}
