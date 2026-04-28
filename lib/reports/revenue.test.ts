import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PaymentStatus } from "@prisma/client";

import { buildTimeline, normalizeRevenueReportQuery, sumPaymentFlows } from "./revenue";

describe("revenue helpers", () => {
  it("default mode là PAYMENT_DATE và tự điền khoảng ngày hiện tại", () => {
    const query = normalizeRevenueReportQuery({});

    assert.equal(query.mode, "PAYMENT_DATE");
    assert.match(query.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(query.to, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("sumPaymentFlows cộng tiền thu và trừ refund đúng convention amount âm", () => {
    const summary = sumPaymentFlows([
      { amount: 1_500_000, status: PaymentStatus.PAID },
      { amount: -300_000, status: PaymentStatus.REFUNDED },
    ]);

    assert.deepEqual(summary, {
      collected: 1_500_000,
      refunded: 300_000,
      netCashIn: 1_200_000,
    });
  });

  it("buildTimeline tạo đủ bucket theo từng ngày", () => {
    const timeline = Array.from(buildTimeline("2026-04-01", "2026-04-03").values());

    assert.equal(timeline.length, 3);
    assert.deepEqual(
      timeline.map((item) => item.date),
      ["2026-04-01", "2026-04-02", "2026-04-03"],
    );
  });
});
