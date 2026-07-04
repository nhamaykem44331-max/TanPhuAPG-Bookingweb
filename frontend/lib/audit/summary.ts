import type { AuditLog, Prisma } from "@prisma/client";

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function extractChangedFields(log: Pick<AuditLog, "after">): string[] {
  const after = asRecord(log.after);
  return Array.isArray(after.changedFields) ? after.changedFields.filter((field): field is string => typeof field === "string") : [];
}

export function buildAuditSummary(log: Pick<AuditLog, "action" | "entity" | "entityId" | "before" | "after">): string {
  const changedFields = extractChangedFields(log);

  if (log.action === "booking.issue") {
    return `Xuất vé booking ${log.entityId}`;
  }

  if (log.action === "booking.cancel") {
    return `Hủy booking ${log.entityId}`;
  }

  if (log.action === "customer.merge") {
    const after = asRecord(log.after);
    const moved = typeof after.totalBookingsMoved === "number" ? after.totalBookingsMoved : 0;
    return `Merge customer vào primary, chuyển ${moved} booking`;
  }

  if (log.action === "price_alert.trigger") {
    return `Price alert ${log.entityId} đã trigger`;
  }

  if (
    log.action === "user.update" ||
    log.action === "customer.update" ||
    log.action === "markup_rule.update" ||
    log.action === "price_alert.update"
  ) {
    return `Cập nhật ${log.entity} ${log.entityId}${changedFields.length ? ` (${changedFields.join(", ")})` : ""}`;
  }

  if (log.action === "user.reset_password") {
    return `Reset mật khẩu tài khoản ${log.entityId}`;
  }

  if (log.action.endsWith(".create")) {
    return `Tạo ${log.entity} ${log.entityId}`;
  }

  return `${log.action} trên ${log.entity} ${log.entityId}`;
}
