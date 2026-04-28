"use server";

import { PriceAlertStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { PriceAlertFormState, PriceAlertFormValues } from "@/app/admin/price-alerts/form-state";
import { getAuditRequestMeta } from "@/lib/audit";
import { PRICE_ALERT_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { createPriceAlert, softDeletePriceAlert, updatePriceAlertStatus } from "@/lib/price-alerts/admin";
import { priceAlertInputSchema } from "@/lib/price-alerts/schemas";

const toggleSchema = z.object({
  id: z.string().min(1),
  status: z.enum([PriceAlertStatus.ACTIVE, PriceAlertStatus.DISABLED]),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

function getFormValues(formData: FormData): PriceAlertFormValues {
  return {
    route: String(formData.get("route") ?? ""),
    airline: String(formData.get("airline") ?? ""),
    targetPrice: String(formData.get("targetPrice") ?? ""),
    direction: String(formData.get("direction") ?? "BELOW"),
  };
}

function buildErrorState(error: z.ZodError, values: PriceAlertFormValues): PriceAlertFormState {
  return {
    status: "error",
    message: "Vui lòng kiểm tra lại thông tin price alert.",
    fieldErrors: error.flatten().fieldErrors,
    values,
  };
}

export async function createPriceAlertAction(_: PriceAlertFormState, formData: FormData): Promise<PriceAlertFormState> {
  const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);
  const values = getFormValues(formData);
  const parsedInput = priceAlertInputSchema.safeParse(values);

  if (!parsedInput.success) {
    return buildErrorState(parsedInput.error, values);
  }

  await createPriceAlert(parsedInput.data, session.user.id, getAuditRequestMeta());
  redirect("/admin/price-alerts?created=1");
}

export async function togglePriceAlertStatusAction(formData: FormData): Promise<void> {
  const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);
  const parsedInput = toggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsedInput.success) {
    return;
  }

  await updatePriceAlertStatus(parsedInput.data.id, { status: parsedInput.data.status }, session.user.id, getAuditRequestMeta());
  redirect("/admin/price-alerts?toggled=1");
}

export async function deletePriceAlertAction(formData: FormData): Promise<void> {
  const session = await requireRole(PRICE_ALERT_MANAGER_ROLES);
  const parsedInput = deleteSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    return;
  }

  await softDeletePriceAlert(parsedInput.data.id, session.user.id, getAuditRequestMeta());
  redirect("/admin/price-alerts?deleted=1");
}
