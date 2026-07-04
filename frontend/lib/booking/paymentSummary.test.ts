import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { calculatePaymentSummary } from "./paymentSummary";

describe("calculatePaymentSummary", () => {
  it("trả tổng thu bằng 0 khi chưa có payment", () => {
    assert.deepEqual(calculatePaymentSummary([], 1_000_000), {
      totalPaid: 0,
      totalDue: 1_000_000,
      balance: 1_000_000,
    });
  });

  it("cộng payment PAID vào tổng đã thu", () => {
    assert.deepEqual(calculatePaymentSummary([{ amount: 1_000_000, status: "PAID" }], 1_000_000), {
      totalPaid: 1_000_000,
      totalDue: 1_000_000,
      balance: 0,
    });
  });

  it("trừ refund âm khỏi tổng đã thu", () => {
    assert.deepEqual(
      calculatePaymentSummary(
        [
          { amount: 1_000_000, status: "PAID" },
          { amount: -500_000, status: "REFUNDED" },
        ],
        1_000_000,
      ),
      {
        totalPaid: 500_000,
        totalDue: 1_000_000,
        balance: 500_000,
      },
    );
  });
});
