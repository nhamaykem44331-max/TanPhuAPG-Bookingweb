import assert from "node:assert/strict";
import { test } from "node:test";

import { realCostFromHold, reconcileHoldAmounts } from "./reconcile";
import type { HoldBookingResponse } from "@/lib/types";

function hold(byPnr: Array<{ pnr: string; totalAmount: number }>, pnrs?: Array<{ pnr: string }>): HoldBookingResponse {
  return {
    success: true,
    totalAmount: null,
    pnrs: (pnrs ?? byPnr.map((b) => ({ pnr: b.pnr }))) as HoldBookingResponse["pnrs"],
    pricing: { verified: false, byPnr },
  } as HoldBookingResponse;
}

test("realCostFromHold: tổng byPnr khi đủ mọi PNR", () => {
  assert.equal(realCostFromHold(hold([{ pnr: "5M658W", totalAmount: 3_902_343 }])), 3_902_343);
  assert.equal(
    realCostFromHold(hold([{ pnr: "AAA111", totalAmount: 2_000_000 }, { pnr: "BBB222", totalAmount: 1_500_000 }])),
    3_500_000,
  );
});

test("realCostFromHold: null khi thiếu/âm giá 1 PNR (không tin tổng)", () => {
  assert.equal(realCostFromHold(hold([{ pnr: "AAA111", totalAmount: 2_000_000 }, { pnr: "BBB222", totalAmount: 0 }])), null);
  const noByPnr = { success: true, totalAmount: null, pnrs: [{ pnr: "X" }], pricing: { verified: false, byPnr: [] } } as unknown as HoldBookingResponse;
  assert.equal(realCostFromHold(noByPnr), null);
});

test("KHÔNG double-count hành lý: realCost đã gồm hành lý → sale = realCost + margin", () => {
  // Đơn thật 3 khách: vé 3.686.343 + hành lý 216.000; realCost byPnr = 3.902.343 (đã gồm hành lý).
  const r = reconcileHoldAmounts({
    quoteNet: 3_686_343,
    quoteSell: 3_986_343, // vé + markup 300k
    quoteMargin: 300_000,
    baggageTotal: 216_000,
    realCost: 3_902_343,
  });
  // realCost == quoteNet+baggage → không reconcile → sale = quoteSell + baggage.
  assert.equal(r.reconcile, null);
  assert.equal(r.netAmount, 3_902_343);
  assert.equal(r.saleAmount, 4_202_343);
  assert.equal(r.profit, 300_000); // markup, KHÔNG bị hành lý làm sai
});

test("THU DƯ trẻ em được sửa XUỐNG khi realCost thấp hơn quote", () => {
  // Quote tính 2 trẻ em như người lớn (thiếu perPax): quoteNet cao; realCost thật thấp hơn.
  const r = reconcileHoldAmounts({
    quoteNet: 8_000_000, // 4 × người lớn (sai)
    quoteSell: 8_400_000,
    quoteMargin: 400_000, // FIXED 100k × 4
    baggageTotal: 0,
    realCost: 7_000_000, // thật: 2 người lớn + 2 trẻ em
  });
  assert.ok(r.reconcile);
  assert.equal(r.netAmount, 7_000_000);
  assert.equal(r.saleAmount, 7_400_000); // vốn thật + margin (FIXED giữ nguyên)
  assert.equal(r.profit, 400_000);
});

test("THU THIẾU (bug cũ) được sửa LÊN khi realCost cao hơn quote", () => {
  const r = reconcileHoldAmounts({
    quoteNet: 1_228_781, // chỉ 1 người (bug cũ)
    quoteSell: 1_328_781,
    quoteMargin: 100_000,
    baggageTotal: 0,
    realCost: 3_686_343, // thật 3 người
  });
  assert.ok(r.reconcile);
  assert.equal(r.netAmount, 3_686_343);
  assert.equal(r.saleAmount, 3_786_343);
  assert.ok(r.saleAmount >= r.netAmount, "không bao giờ bán dưới vốn");
});

test("realCost null (chưa có giá) → giữ quote (+ hành lý), không phá", () => {
  const r = reconcileHoldAmounts({
    quoteNet: 2_000_000,
    quoteSell: 2_100_000,
    quoteMargin: 100_000,
    baggageTotal: 150_000,
    realCost: null,
  });
  assert.equal(r.reconcile, null);
  assert.equal(r.netAmount, 2_150_000);
  assert.equal(r.saleAmount, 2_250_000);
});

test("lệch trong ngưỡng (≤ tolerance) → giữ quote, không reconcile", () => {
  const r = reconcileHoldAmounts({
    quoteNet: 2_000_000,
    quoteSell: 2_100_000,
    quoteMargin: 100_000,
    baggageTotal: 0,
    realCost: 2_005_000, // lệch 5.000 < 10.000
  });
  assert.equal(r.reconcile, null);
  assert.equal(r.saleAmount, 2_100_000);
});
