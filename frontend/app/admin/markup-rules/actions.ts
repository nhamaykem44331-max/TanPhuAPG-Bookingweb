"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { MarkupRuleFormState, MarkupRuleFormValues } from "@/app/admin/markup-rules/form-state";
import { getAuditRequestMeta } from "@/lib/audit";
import { MARKUP_RULE_MANAGER_ROLES } from "@/lib/auth/constants";
import { AdminRouteError, requireRole } from "@/lib/auth/requireRole";
import {
  createMarkupRule,
  hardDeleteMarkupRule,
  MarkupRuleNotFoundError,
  softDeleteMarkupRule,
  updateMarkupRule,
} from "@/lib/pricing/markupRules";
import { markupRuleInputSchema, markupRulePatchSchema } from "@/lib/pricing/schemas";
import { clearSearchMarkupCache } from "@/lib/pricing/searchMarkup";

export type MarkupRuleFormAction = (
  state: MarkupRuleFormState,
  formData: FormData,
) => Promise<MarkupRuleFormState>;

const toggleInputSchema = z.object({
  id: z.string().min(1),
  active: z.preprocess((value) => value === "true" || value === true, z.boolean()),
});

const deleteInputSchema = z.object({
  id: z.string().min(1),
});

function getFormValues(formData: FormData): MarkupRuleFormValues {
  return {
    scope: String(formData.get("scope") ?? ""),
    airline: String(formData.get("airline") ?? ""),
    channel: String(formData.get("channel") ?? ""),
    cabin: String(formData.get("cabin") ?? ""),
    paxType: String(formData.get("paxType") ?? ""),
    domesticInternational: String(formData.get("domesticInternational") ?? ""),
    routeFrom: String(formData.get("routeFrom") ?? ""),
    routeTo: String(formData.get("routeTo") ?? ""),
    markupType: String(formData.get("markupType") ?? "FIXED"),
    markupValue: String(formData.get("markupValue") ?? ""),
    serviceFee: String(formData.get("serviceFee") ?? "0"),
    priority: String(formData.get("priority") ?? "10"),
    active: String(formData.get("active") ?? "true"),
  };
}

function buildErrorState(
  error: z.ZodError,
  values: MarkupRuleFormValues,
  message = "Vui lòng kiểm tra lại thông tin rule.",
): MarkupRuleFormState {
  return {
    status: "error",
    message,
    fieldErrors: error.flatten().fieldErrors,
    values,
  };
}

function buildExceptionState(error: unknown, values: MarkupRuleFormValues): MarkupRuleFormState {
  if (error instanceof AdminRouteError) {
    return {
      status: "error",
      message: error.message,
      values,
    };
  }
  if (error instanceof MarkupRuleNotFoundError) {
    return {
      status: "error",
      message: error.message,
      values,
    };
  }
  const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
  return {
    status: "error",
    message: `Lưu rule thất bại: ${message}`,
    values,
  };
}

async function requireMarkupRuleManager() {
  return requireRole(MARKUP_RULE_MANAGER_ROLES);
}

/**
 * Sau mỗi thao tác CUD: revalidate đường dẫn liên quan + clear cache rule trong searchMarkup
 * (cache 60s) để giá trên trang chủ /api/search phản ánh thay đổi ngay.
 */
function notifyRulesChanged() {
  try {
    clearSearchMarkupCache();
  } catch {
    /* swallow — cache có thể chưa khởi tạo */
  }
  revalidatePath("/admin/markup");
  revalidatePath("/admin/markup-rules");
}

export async function createMarkupRuleAction(
  _: MarkupRuleFormState,
  formData: FormData,
): Promise<MarkupRuleFormState> {
  const values = getFormValues(formData);

  try {
    const session = await requireMarkupRuleManager();
    const parsedInput = markupRuleInputSchema.safeParse(values);
    if (!parsedInput.success) {
      return buildErrorState(parsedInput.error, values);
    }

    await createMarkupRule(parsedInput.data, session.user.id, getAuditRequestMeta());
    notifyRulesChanged();
  } catch (error) {
    return buildExceptionState(error, values);
  }

  // redirect() phải nằm NGOÀI try/catch vì nó throw NEXT_REDIRECT (Next.js intercept).
  // Nếu nuốt trong catch sẽ chặn navigation và làm hỏng useFormState.
  redirect("/admin/markup?created=1");
}

export async function updateMarkupRuleAction(
  ruleId: string,
  _: MarkupRuleFormState,
  formData: FormData,
): Promise<MarkupRuleFormState> {
  const values = getFormValues(formData);

  try {
    const session = await requireMarkupRuleManager();
    const parsedInput = markupRulePatchSchema.safeParse(values);
    if (!parsedInput.success) {
      return buildErrorState(parsedInput.error, values);
    }

    await updateMarkupRule(ruleId, parsedInput.data, session.user.id, getAuditRequestMeta());
    notifyRulesChanged();
  } catch (error) {
    return buildExceptionState(error, values);
  }

  redirect("/admin/markup?updated=1");
}

export async function toggleMarkupRuleActiveAction(formData: FormData): Promise<void> {
  let shouldRedirect = false;
  try {
    const session = await requireMarkupRuleManager();
    const parsedInput = toggleInputSchema.safeParse({
      id: formData.get("id"),
      active: formData.get("active"),
    });
    if (!parsedInput.success) return;

    await updateMarkupRule(
      parsedInput.data.id,
      { active: parsedInput.data.active },
      session.user.id,
      getAuditRequestMeta(),
    );
    notifyRulesChanged();
    shouldRedirect = true;
  } catch (error) {
    console.error("[markup-rules/toggle] failed:", error);
    // Không throw — để UI quay về list page với state cũ thay vì crash error boundary
  }

  if (shouldRedirect) {
    redirect("/admin/markup?toggled=1");
  } else {
    redirect("/admin/markup?error=toggle");
  }
}

/**
 * Hard delete: xoá hẳn rule khỏi DB. Match với expectation của admin khi click "Xóa".
 * Audit log "markup_rule.hard_delete" vẫn được ghi để truy vết.
 */
export async function deleteMarkupRuleAction(formData: FormData): Promise<void> {
  let success = false;
  try {
    const session = await requireMarkupRuleManager();
    const parsedInput = deleteInputSchema.safeParse({
      id: formData.get("id"),
    });
    if (!parsedInput.success) return;

    await hardDeleteMarkupRule(parsedInput.data.id, session.user.id, getAuditRequestMeta());
    notifyRulesChanged();
    success = true;
  } catch (error) {
    console.error("[markup-rules/delete] failed:", error);
  }

  redirect(success ? "/admin/markup?deleted=1" : "/admin/markup?error=delete");
}

/**
 * Tuỳ chọn legacy: soft delete (chỉ tắt active) — giữ lại để callable nếu UI tương lai
 * cần phân biệt "tạm tắt" vs "xoá hẳn". Hiện tại không được gọi từ UI.
 */
export async function softDeleteMarkupRuleAction(formData: FormData): Promise<void> {
  let success = false;
  try {
    const session = await requireMarkupRuleManager();
    const parsedInput = deleteInputSchema.safeParse({
      id: formData.get("id"),
    });
    if (!parsedInput.success) return;

    await softDeleteMarkupRule(parsedInput.data.id, session.user.id, getAuditRequestMeta());
    notifyRulesChanged();
    success = true;
  } catch (error) {
    console.error("[markup-rules/soft-delete] failed:", error);
  }

  redirect(success ? "/admin/markup?archived=1" : "/admin/markup?error=archive");
}
