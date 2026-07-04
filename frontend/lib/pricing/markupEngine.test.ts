import test from "node:test";
import assert from "node:assert/strict";

import prismaClient from "@prisma/client";
import type { MarkupRule, Prisma as PrismaNamespace } from "@prisma/client";

import { InvalidMarkupRuleError } from "./errors";
import { computeMarkup, type CompatibleMarkupRule, type QuoteInput } from "./markupEngine";

const { MarkupType, Prisma } = prismaClient;

type RuleMarkupValue = string | number | PrismaNamespace.Decimal;

function decimal(value: string | number): PrismaNamespace.Decimal {
  return new Prisma.Decimal(value);
}

function quoteInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    airline: "VJ",
    channel: "web",
    fareClass: "Y",
    paxType: "ADT",
    domesticInternational: "DOMESTIC",
    tripType: "ONEWAY",
    route: "SGN-HAN",
    netPrice: decimal("1000000"),
    ...overrides,
  };
}

function createRule(
  overrides: Partial<Omit<CompatibleMarkupRule, "markupValue">> & {
    id: string;
    markupType: CompatibleMarkupRule["markupType"];
    markupValue: RuleMarkupValue;
  },
): CompatibleMarkupRule {
  const baseRule: MarkupRule = {
    id: overrides.id,
    scope: "Default rule",
    channel: null,
    airline: null,
    cabin: null,
    paxType: null,
    domesticInternational: null,
    routeFrom: null,
    routeTo: null,
    markupType: overrides.markupType,
    markupValue: new Prisma.Decimal(overrides.markupValue),
    serviceFee: 0,
    active: true,
    priority: 10,
    createdById: null,
    createdAt: new Date("2026-04-23T00:00:00.000Z"),
  };

  return {
    ...baseRule,
    ...overrides,
    markupValue: new Prisma.Decimal(overrides.markupValue),
  };
}

test("1. Rule FIXED match airline -> markupAmount = rule.markupValue", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-fixed-vj",
      airline: "VJ",
      markupType: MarkupType.FIXED,
      markupValue: "150000",
    }),
  ]);

  assert.equal(result.markupAmount.toFixed(0), "150000");
  assert.equal(result.sellPrice.toFixed(0), "1150000");
});

test("2. Rule PERCENT match airline -> markupAmount = round(netPrice * pct / 100)", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-percent-vj",
      airline: "VJ",
      markupType: MarkupType.PERCENT,
      markupValue: "10",
    }),
  ]);

  assert.equal(result.markupAmount.toFixed(0), "100000");
  assert.equal(result.sellPrice.toFixed(0), "1100000");
});

test("3. Rule FIXED với airline=null áp cho airline bất kỳ", async () => {
  const result = await computeMarkup(quoteInput({ airline: "VN" }), [
    createRule({
      id: "rule-global",
      markupType: MarkupType.FIXED,
      markupValue: "150000",
      airline: null,
    }),
  ]);

  assert.equal(result.ruleId, "rule-global");
  assert.equal(result.markupAmount.toFixed(0), "150000");
});

test("4. Rule airline='VJ' priority 50 thắng rule default priority 10", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-default",
      markupType: MarkupType.FIXED,
      markupValue: "150000",
      priority: 10,
      airline: null,
    }),
    createRule({
      id: "rule-vj",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      priority: 50,
      airline: "VJ",
    }),
  ]);

  assert.equal(result.ruleId, "rule-vj");
  assert.equal(result.markupAmount.toFixed(0), "100000");
});

test("5. Không rule nào match -> markupAmount = 0, ruleId = null, sellPrice = netPrice", async () => {
  const result = await computeMarkup(quoteInput({ airline: "QH" }), [
    createRule({
      id: "rule-vj-only",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      airline: "VJ",
    }),
  ]);

  assert.equal(result.ruleId, null);
  assert.equal(result.markupAmount.toFixed(0), "0");
  assert.equal(result.sellPrice.toFixed(0), "1000000");
});

test("6. Rule PERCENT value=12.5 và netPrice=1000000 -> markupAmount = 125000", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-percent-12-5",
      markupType: MarkupType.PERCENT,
      markupValue: "12.5",
    }),
  ]);

  assert.equal(result.markupAmount.toFixed(0), "125000");
});

test("7. Rule inactive bị bỏ qua", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-inactive",
      markupType: MarkupType.FIXED,
      markupValue: "500000",
      active: false,
      priority: 100,
    }),
    createRule({
      id: "rule-active",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      active: true,
      priority: 10,
    }),
  ]);

  assert.equal(result.ruleId, "rule-active");
  assert.equal(result.markupAmount.toFixed(0), "100000");
});

test("8. Rule fareClass='Y' không match khi input fareClass='C'", async () => {
  const result = await computeMarkup(quoteInput({ fareClass: "C" }), [
    createRule({
      id: "rule-fare-y",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      fareClass: "Y",
    }),
  ]);

  assert.equal(result.ruleId, null);
  assert.equal(result.markupAmount.toFixed(0), "0");
});

test("9. Rule fareClass=null match cho mọi fareClass", async () => {
  const result = await computeMarkup(quoteInput({ fareClass: "C" }), [
    createRule({
      id: "rule-fare-any",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      fareClass: null,
    }),
  ]);

  assert.equal(result.ruleId, "rule-fare-any");
});

test("10. Tie-break priority bằng nhau -> rule tạo trước thắng", async () => {
  const result = await computeMarkup(quoteInput(), [
    createRule({
      id: "rule-newer",
      markupType: MarkupType.FIXED,
      markupValue: "200000",
      priority: 50,
      createdAt: new Date("2026-04-23T10:00:00.000Z"),
    }),
    createRule({
      id: "rule-older",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      priority: 50,
      createdAt: new Date("2026-04-23T09:00:00.000Z"),
    }),
  ]);

  assert.equal(result.ruleId, "rule-older");
  assert.equal(result.markupAmount.toFixed(0), "100000");
});

test("11. Rule có markupValue âm -> throw InvalidMarkupRuleError", async () => {
  await assert.rejects(
    () =>
      computeMarkup(quoteInput(), [
        createRule({
          id: "rule-invalid-negative",
          markupType: MarkupType.FIXED,
          markupValue: "-1",
        }),
      ]),
    (error: unknown) => {
      assert.ok(error instanceof InvalidMarkupRuleError);
      assert.equal(error.ruleId, "rule-invalid-negative");
      return true;
    },
  );
});

test("12. PERCENT với netPrice=999999, pct=10 -> markupAmount = 100000 (round half-up)", async () => {
  const result = await computeMarkup(quoteInput({ netPrice: decimal("999999") }), [
    createRule({
      id: "rule-percent-half-up",
      markupType: MarkupType.PERCENT,
      markupValue: "10",
    }),
  ]);

  assert.equal(result.markupAmount.toFixed(0), "100000");
  assert.equal(result.sellPrice.toFixed(0), "1099999");
});

test("13. Rule channel='admin' match khi input channel='admin'", async () => {
  const result = await computeMarkup(quoteInput({ channel: "admin" }), [
    createRule({
      id: "rule-channel-admin",
      markupType: MarkupType.FIXED,
      markupValue: "250000",
      channel: "admin",
    }),
  ]);

  assert.equal(result.ruleId, "rule-channel-admin");
  assert.equal(result.markupAmount.toFixed(0), "250000");
});

test("14. Rule channel mismatch bị bỏ qua và fallback sang rule default", async () => {
  const result = await computeMarkup(quoteInput({ channel: "web" }), [
    createRule({
      id: "rule-channel-admin-only",
      markupType: MarkupType.FIXED,
      markupValue: "300000",
      channel: "admin",
      priority: 50,
    }),
    createRule({
      id: "rule-channel-default",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      channel: null,
      priority: 10,
    }),
  ]);

  assert.equal(result.ruleId, "rule-channel-default");
  assert.equal(result.markupAmount.toFixed(0), "100000");
});

test("15. Rule paxType='CHD' match khi input paxType='CHD'", async () => {
  const result = await computeMarkup(quoteInput({ paxType: "CHD" }), [
    createRule({
      id: "rule-pax-chd",
      markupType: MarkupType.FIXED,
      markupValue: "90000",
      paxType: "CHD",
    }),
  ]);

  assert.equal(result.ruleId, "rule-pax-chd");
});

test("16. Rule domesticInternational='INTERNATIONAL' match khi input international", async () => {
  const result = await computeMarkup(quoteInput({ domesticInternational: "INTERNATIONAL" }), [
    createRule({
      id: "rule-international",
      markupType: MarkupType.FIXED,
      markupValue: "350000",
      domesticInternational: "INTERNATIONAL",
    }),
  ]);

  assert.equal(result.ruleId, "rule-international");
  assert.equal(result.markupAmount.toFixed(0), "350000");
});

test("17. Rule routeFrom/routeTo exact match khi input route trùng", async () => {
  const result = await computeMarkup(quoteInput({ route: "SGN-HAN" }), [
    createRule({
      id: "rule-route-sgn-han",
      markupType: MarkupType.FIXED,
      markupValue: "180000",
      routeFrom: "SGN",
      routeTo: "HAN",
    }),
  ]);

  assert.equal(result.ruleId, "rule-route-sgn-han");
});

test("18. Rule route mismatch bị bỏ qua và fallback sang rule default", async () => {
  const result = await computeMarkup(quoteInput({ route: "SGN-DAD" }), [
    createRule({
      id: "rule-route-sgn-han-only",
      markupType: MarkupType.FIXED,
      markupValue: "220000",
      routeFrom: "SGN",
      routeTo: "HAN",
      priority: 50,
    }),
    createRule({
      id: "rule-route-default",
      markupType: MarkupType.FIXED,
      markupValue: "110000",
      priority: 10,
    }),
  ]);

  assert.equal(result.ruleId, "rule-route-default");
  assert.equal(result.markupAmount.toFixed(0), "110000");
});
