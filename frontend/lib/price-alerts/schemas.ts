import { PriceAlertDir, PriceAlertStatus } from "@prisma/client";
import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const routeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}-[A-Z]{3}$/, "Route phải có định dạng SGN-HAN");

const airlineSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Airline phải có 2 ký tự")
    .regex(/^[A-Z0-9]{2}$/)
    .optional(),
);

export const priceAlertInputSchema = z.object({
  route: routeSchema,
  airline: airlineSchema,
  targetPrice: z.coerce.number().int().positive().max(10_000_000_000),
  direction: z.nativeEnum(PriceAlertDir),
});

export const priceAlertListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(PriceAlertStatus).optional()),
  airline: airlineSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const priceAlertPatchSchema = z.object({
  status: z.enum([PriceAlertStatus.ACTIVE, PriceAlertStatus.DISABLED]),
});

export type PriceAlertInput = z.infer<typeof priceAlertInputSchema>;
export type PriceAlertListQuery = z.infer<typeof priceAlertListQuerySchema>;
export type PriceAlertPatchInput = z.infer<typeof priceAlertPatchSchema>;
