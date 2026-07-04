import prismaClient from "@prisma/client";
import type { MarkupRule, Prisma as PrismaNamespace } from "@prisma/client";

import { InvalidMarkupRuleError } from "./errors";

const { Prisma } = prismaClient;

export interface QuoteInput {
  airline: string;
  channel?: string | null;
  fareClass?: string | null;
  paxType?: string | null;
  domesticInternational?: string | null;
  tripType: "ONEWAY" | "ROUNDTRIP";
  route?: string | null;
  netPrice: PrismaNamespace.Decimal;
}

export interface MarkupResult {
  ruleId: string | null;
  ruleName: string | null;
  markupType: "FIXED" | "PERCENT" | null;
  markupValue: PrismaNamespace.Decimal | null;
  markupAmount: PrismaNamespace.Decimal;
  sellPrice: PrismaNamespace.Decimal;
}

export type CompatibleMarkupRule = MarkupRule & {
  name?: string | null;
  fareClass?: string | null;
  tripType?: QuoteInput["tripType"] | null;
};

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function getRuleFareClass(rule: CompatibleMarkupRule): string | null {
  return normalizeText(rule.fareClass ?? rule.cabin ?? null);
}

function getRuleTripType(rule: CompatibleMarkupRule): QuoteInput["tripType"] | null {
  const value = normalizeText(rule.tripType ?? null);
  if (value === "ONEWAY" || value === "ROUNDTRIP") {
    return value;
  }
  return null;
}

function parseRoute(route: string | null | undefined): { routeFrom: string | null; routeTo: string | null } {
  const value = normalizeText(route);

  if (!value) {
    return {
      routeFrom: null,
      routeTo: null,
    };
  }

  const parts = value.split("-");

  if (parts.length !== 2 || parts.some((part) => part.length !== 3)) {
    return {
      routeFrom: null,
      routeTo: null,
    };
  }

  return {
    routeFrom: parts[0],
    routeTo: parts[1],
  };
}

function matchesNullableRuleValue(ruleValue: string | null | undefined, inputValue: string | null): boolean {
  const normalizedRuleValue = normalizeText(ruleValue);

  if (!normalizedRuleValue) {
    return true;
  }

  return normalizedRuleValue === inputValue;
}

function matchesRule(rule: CompatibleMarkupRule, input: QuoteInput): boolean {
  const airline = normalizeText(input.airline);
  const channel = normalizeText(input.channel ?? null);
  const fareClass = normalizeText(input.fareClass ?? null);
  const paxType = normalizeText(input.paxType ?? null);
  const domesticInternational = normalizeText(input.domesticInternational ?? null);
  const tripType = normalizeText(input.tripType);
  const route = parseRoute(input.route);

  const matchesAirline = matchesNullableRuleValue(rule.airline, airline);
  const matchesChannel = matchesNullableRuleValue(rule.channel, channel);
  const matchesFareClass = matchesNullableRuleValue(getRuleFareClass(rule), fareClass);
  const matchesPaxType = matchesNullableRuleValue(rule.paxType, paxType);
  const matchesDomesticInternational = matchesNullableRuleValue(rule.domesticInternational, domesticInternational);
  const matchesTripType = matchesNullableRuleValue(getRuleTripType(rule), tripType);
  const matchesRouteFrom = matchesNullableRuleValue(rule.routeFrom, route.routeFrom);
  const matchesRouteTo = matchesNullableRuleValue(rule.routeTo, route.routeTo);

  return (
    matchesAirline &&
    matchesChannel &&
    matchesFareClass &&
    matchesPaxType &&
    matchesDomesticInternational &&
    matchesTripType &&
    matchesRouteFrom &&
    matchesRouteTo
  );
}

function sortRules(rules: CompatibleMarkupRule[]): CompatibleMarkupRule[] {
  return [...rules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function zeroMarkup(netPrice: PrismaNamespace.Decimal): MarkupResult {
  return {
    ruleId: null,
    ruleName: null,
    markupType: null,
    markupValue: null,
    markupAmount: new Prisma.Decimal(0),
    sellPrice: new Prisma.Decimal(netPrice),
  };
}

function computeMarkupAmount(rule: CompatibleMarkupRule, netPrice: PrismaNamespace.Decimal): PrismaNamespace.Decimal {
  const markupValue = new Prisma.Decimal(rule.markupValue);

  if (markupValue.lessThan(0)) {
    throw new InvalidMarkupRuleError("Markup rule không được âm.", rule.id);
  }

  if (rule.markupType === "FIXED") {
    return markupValue;
  }

  if (rule.markupType === "PERCENT") {
    return netPrice
      .mul(markupValue)
      .div(100)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  }

  throw new InvalidMarkupRuleError("Markup type không hợp lệ.", rule.id);
}

async function loadActiveRules(): Promise<CompatibleMarkupRule[]> {
  const { prisma } = await import("../db");
  const rules = await prisma.markupRule.findMany({
    where: { active: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return rules;
}

export async function computeMarkup(
  input: QuoteInput,
  rules?: CompatibleMarkupRule[],
): Promise<MarkupResult> {
  const candidateRules = rules ? sortRules(rules.filter((rule) => rule.active)) : await loadActiveRules();
  const matchedRule = candidateRules.find((rule) => matchesRule(rule, input));

  if (!matchedRule) {
    return zeroMarkup(input.netPrice);
  }

  const markupAmount = computeMarkupAmount(matchedRule, input.netPrice);

  return {
    ruleId: matchedRule.id,
    ruleName: matchedRule.name ?? matchedRule.scope ?? null,
    markupType: matchedRule.markupType,
    markupValue: new Prisma.Decimal(matchedRule.markupValue),
    markupAmount,
    sellPrice: new Prisma.Decimal(input.netPrice).plus(markupAmount),
  };
}
