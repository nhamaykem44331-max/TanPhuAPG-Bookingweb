import prismaClient from "@prisma/client";
import { z } from "zod";

const { Prisma } = prismaClient;

function emptyStringToNull(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeBoolean(value: unknown): unknown {
  if (value === true || value === "true" || value === "1" || value === 1 || value === "on") {
    return true;
  }

  if (value === false || value === "false" || value === "0" || value === 0) {
    return false;
  }

  return value;
}

function normalizeInteger(value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value.trim());
  }

  return value;
}

function normalizeDecimal(value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

const uppercaseNullableField = (regex: RegExp, message: string) =>
  z.preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .regex(regex, message)
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
  );

const nullableShortTextField = z.preprocess(
  emptyStringToNull,
  z
    .string()
    .trim()
    .max(20, "Tối đa 20 ký tự.")
    .nullable()
    .optional(),
);

const markupValueField = z.preprocess(
  normalizeDecimal,
  z
    .union([z.string().min(1), z.number().positive()])
    .transform((value) => new Prisma.Decimal(value))
    .refine((value) => value.greaterThan(0), "Giá trị markup phải lớn hơn 0."),
);

const serviceFeeField = z.preprocess(
  normalizeInteger,
  z.number().int("Phí dịch vụ phải là số nguyên.").min(0).max(10_000_000),
);

const priorityField = z.preprocess(
  normalizeInteger,
  z.number().int("Priority phải là số nguyên.").min(1).max(999),
);

const activeField = z.preprocess(normalizeBoolean, z.boolean());

export const markupRuleInputSchema = z
  .object({
    scope: z.string().trim().min(3, "Scope tối thiểu 3 ký tự.").max(80, "Scope tối đa 80 ký tự."),
    airline: uppercaseNullableField(/^[A-Z0-9]{2}$/, "Airline phải gồm 2 ký tự."),
    channel: z.preprocess(
      emptyStringToNull,
      z.enum(["web", "admin"]).nullable().optional(),
    ),
    cabin: nullableShortTextField,
    paxType: z.preprocess(
      emptyStringToNull,
      z.enum(["ADT", "CHD", "INF"]).nullable().optional(),
    ),
    domesticInternational: z.preprocess(
      emptyStringToNull,
      z.enum(["DOMESTIC", "INTERNATIONAL"]).nullable().optional(),
    ),
    routeFrom: uppercaseNullableField(/^[A-Z]{3}$/, "Sân bay đi phải gồm 3 ký tự."),
    routeTo: uppercaseNullableField(/^[A-Z]{3}$/, "Sân bay đến phải gồm 3 ký tự."),
    markupType: z.enum(["FIXED", "PERCENT"]),
    markupValue: markupValueField,
    serviceFee: serviceFeeField,
    priority: priorityField,
    active: activeField,
  })
  .refine(
    (value) => value.markupType !== "PERCENT" || value.markupValue.lessThanOrEqualTo(100),
    {
      message: "PERCENT markup không được vượt 100.",
      path: ["markupValue"],
    },
  );

export const markupRulePatchSchema = z
  .object({
    scope: z.string().trim().min(3, "Scope tối thiểu 3 ký tự.").max(80, "Scope tối đa 80 ký tự.").optional(),
    airline: uppercaseNullableField(/^[A-Z0-9]{2}$/, "Airline phải gồm 2 ký tự."),
    channel: z.preprocess(
      emptyStringToNull,
      z.enum(["web", "admin"]).nullable().optional(),
    ),
    cabin: nullableShortTextField,
    paxType: z.preprocess(
      emptyStringToNull,
      z.enum(["ADT", "CHD", "INF"]).nullable().optional(),
    ),
    domesticInternational: z.preprocess(
      emptyStringToNull,
      z.enum(["DOMESTIC", "INTERNATIONAL"]).nullable().optional(),
    ),
    routeFrom: uppercaseNullableField(/^[A-Z]{3}$/, "Sân bay đi phải gồm 3 ký tự."),
    routeTo: uppercaseNullableField(/^[A-Z]{3}$/, "Sân bay đến phải gồm 3 ký tự."),
    markupType: z.enum(["FIXED", "PERCENT"]).optional(),
    markupValue: markupValueField.optional(),
    serviceFee: serviceFeeField.optional(),
    priority: priorityField.optional(),
    active: activeField.optional(),
  })
  .refine(
    (value) =>
      value.markupType !== "PERCENT" ||
      value.markupValue === undefined ||
      value.markupValue.lessThanOrEqualTo(100),
    {
      message: "PERCENT markup không được vượt 100.",
      path: ["markupValue"],
    },
  );

export const markupRuleListFilterSchema = z.object({
  active: z.preprocess((value) => {
    if (value === null || value === undefined || value === "" || value === "all") {
      return undefined;
    }

    return normalizeBoolean(value);
  }, z.boolean().optional()),
  airline: uppercaseNullableField(/^[A-Z0-9]{2}$/, "Airline phải gồm 2 ký tự."),
});

export type MarkupRuleInput = z.infer<typeof markupRuleInputSchema>;
export type MarkupRulePatchInput = z.infer<typeof markupRulePatchSchema>;
export type MarkupRuleListFilter = z.infer<typeof markupRuleListFilterSchema>;
