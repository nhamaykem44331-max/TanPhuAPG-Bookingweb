import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPayOSDedupeKey,
  buildPayOSDescription,
  classifyPaymentAmount,
  parsePayOSTransactionDateTime,
} from "./reconciliation";

describe("payment reconciliation helpers", () => {
  it("phân loại thanh toán đúng số tiền là PAID", () => {
    assert.deepEqual(classifyPaymentAmount({ expectedAmount: 1_500_000, transferredAmount: 1_500_000 }), {
      decision: "PAID",
      reason: null,
    });
  });

  it("phân loại thanh toán thiếu là PARTIAL", () => {
    assert.deepEqual(classifyPaymentAmount({ expectedAmount: 1_500_000, transferredAmount: 1_000_000 }), {
      decision: "PARTIAL",
      reason: "UNDERPAID",
    });
  });

  it("phân loại chuyển dư là MANUAL_REVIEW", () => {
    assert.deepEqual(classifyPaymentAmount({ expectedAmount: 1_500_000, transferredAmount: 1_700_000 }), {
      decision: "MANUAL_REVIEW",
      reason: "OVERPAID",
    });
  });

  it("tạo dedupe key ưu tiên reference của payOS", () => {
    assert.equal(
      buildPayOSDedupeKey({
        reference: "TF230204212323",
        paymentLinkId: "link_123",
        orderCode: 123,
        amount: 3000,
      }),
      "PAYOS:TF230204212323:3000",
    );
  });

  it("parse thời gian webhook payOS theo múi giờ Việt Nam", () => {
    assert.equal(parsePayOSTransactionDateTime("2026-04-24 18:25:00")?.toISOString(), "2026-04-24T11:25:00.000Z");
  });

  it("tạo nội dung chuyển khoản ngắn, ổn định theo orderCode", () => {
    assert.equal(buildPayOSDescription("1770000123456"), "APG1770000123456");
  });
});
