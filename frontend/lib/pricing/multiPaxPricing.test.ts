import assert from "node:assert/strict";
import { test } from "node:test";

import prismaClient from "@prisma/client";

import { multiPaxNet, paxScaledMarkupAmount } from "./quoteService";
import { computeMarkup, type CompatibleMarkupRule } from "./markupEngine";

const { Prisma } = prismaClient;
const D = (v: number | string) => new Prisma.Decimal(v);

function fixedRule(value: number): CompatibleMarkupRule {
  return {
    id: "rule-fixed",
    scope: "GLOBAL",
    airline: null,
    channel: null,
    cabin: null,
    fareClass: null,
    paxType: null,
    domesticInternational: null,
    tripType: null,
    routeFrom: null,
    routeTo: null,
    markupType: "FIXED",
    markupValue: D(value),
    serviceFee: D(0),
    priority: 10,
    active: true,
    createdAt: new Date("2026-01-01"),
  } as unknown as CompatibleMarkupRule;
}

function percentRule(pct: number): CompatibleMarkupRule {
  return { ...fixedRule(0), id: "rule-pct", markupType: "PERCENT", markupValue: D(pct) } as CompatibleMarkupRule;
}

test("BUG REGRESSION: net cả đoàn = per-pax × số khách (đơn 3 người lớn HAN-CXR)", () => {
  // Chính là đơn APG-260707-D56624: 3 ADT × 1.228.781 = 3.686.343 (trước đây chỉ tính 1 người).
  const perPax = { adt: D(1_228_781), chd: D(0), inf: D(0) };
  const net = multiPaxNet(perPax, { adults: 3, children: 0, infants: 0 });
  assert.equal(net.toString(), "3686343");
});

test("net cả đoàn cộng đúng nhiều loại khách (2 ADT + 1 CHD + 1 INF)", () => {
  const perPax = { adt: D(1_000_000), chd: D(800_000), inf: D(150_000) };
  const net = multiPaxNet(perPax, { adults: 2, children: 1, infants: 1 });
  assert.equal(net.toString(), String(2 * 1_000_000 + 800_000 + 150_000)); // 2.950.000
});

test("DECISION: markup FIXED nhân theo số khách", async () => {
  const net = multiPaxNet({ adt: D(1_228_781), chd: D(0), inf: D(0) }, { adults: 3, children: 0, infants: 0 });
  const markup = await computeMarkup(
    { airline: "VJ", tripType: "ONEWAY", route: "HAN-CXR", netPrice: net },
    [fixedRule(100_000)],
  );
  // markup FIXED = 100.000 (1 lần) → × 3 khách = 300.000
  assert.equal(paxScaledMarkupAmount(markup, 3).toString(), "300000");
});

test("DECISION: em bé ngồi lòng (INF) KHÔNG bị tính markup, nhưng VẪN tính vé", async () => {
  // 2 ADT + 1 INF. Vé em bé (150k) VẪN nằm trong giá vốn; markup CHỈ tính cho 2 người lớn.
  const perPax = { adt: D(1_000_000), chd: D(0), inf: D(150_000) };
  const netAll = multiPaxNet(perPax, { adults: 2, children: 0, infants: 1 });
  assert.equal(netAll.toString(), "2150000"); // gồm vé em bé
  const markupBaseNet = multiPaxNet(perPax, { adults: 2, children: 0, infants: 0 });
  assert.equal(markupBaseNet.toString(), "2000000"); // loại em bé khỏi base markup
  const markup = await computeMarkup(
    { airline: "VJ", tripType: "ONEWAY", route: "HAN-SGN", netPrice: markupBaseNet },
    [fixedRule(100_000)],
  );
  const chargeablePaxCount = 2; // ADT + CHD (không gồm INF)
  assert.equal(paxScaledMarkupAmount(markup, chargeablePaxCount).toString(), "200000"); // 100k × 2, KHÔNG × 3
  // saleAmount = vốn (gồm vé em bé) + markup 2 khách = 2.150.000 + 200.000
  assert.equal(Number(netAll.plus(paxScaledMarkupAmount(markup, chargeablePaxCount)).toFixed(0)), 2_350_000);
});

test("markup PERCENT tự nhân theo net cả đoàn (không nhân pax lần nữa)", async () => {
  const net = multiPaxNet({ adt: D(1_000_000), chd: D(0), inf: D(0) }, { adults: 3, children: 0, infants: 0 });
  const markup = await computeMarkup(
    { airline: "VJ", tripType: "ONEWAY", route: "HAN-SGN", netPrice: net },
    [percentRule(10)],
  );
  // 10% của net cả đoàn (3.000.000) = 300.000; KHÔNG nhân 3 lần nữa.
  assert.equal(paxScaledMarkupAmount(markup, 3).toString(), "300000");
});

test("END-TO-END: saleAmount đơn 3 người = vốn + markup×pax + hành lý (khớp Nam Thành)", async () => {
  const net = multiPaxNet({ adt: D(1_228_781), chd: D(0), inf: D(0) }, { adults: 3, children: 0, infants: 0 });
  const markup = await computeMarkup(
    { airline: "VJ", tripType: "ONEWAY", route: "HAN-CXR", netPrice: net },
    [fixedRule(100_000)],
  );
  const markupAmount = paxScaledMarkupAmount(markup, 3);
  const baggage = 216_000;
  const netAmount = Number(net.toFixed(0)) + baggage; // = 3.902.343 (đúng tổng vốn Nam Thành)
  const saleAmount = Number(net.plus(markupAmount).toFixed(0)) + baggage; // vốn + markup + hành lý
  assert.equal(netAmount, 3_902_343);
  assert.equal(saleAmount, 4_202_343);
  // Trước bản vá: saleAmount = 1.544.781 (chỉ 1 người) → nay đã đúng cho cả 3 khách.
});
