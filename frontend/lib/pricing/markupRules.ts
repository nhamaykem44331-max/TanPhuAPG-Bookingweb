import type { MarkupRule, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { AuditRequestMeta } from "@/lib/audit";
import type { MarkupRuleInput, MarkupRuleListFilter, MarkupRulePatchInput } from "@/lib/pricing/schemas";

export class MarkupRuleNotFoundError extends Error {
  constructor(ruleId: string) {
    super(`Không tìm thấy rule ${ruleId}.`);
    this.name = "MarkupRuleNotFoundError";
  }
}

const markupRuleEditableFields = [
  "scope",
  "airline",
  "channel",
  "cabin",
  "paxType",
  "domesticInternational",
  "routeFrom",
  "routeTo",
  "markupType",
  "markupValue",
  "serviceFee",
  "priority",
  "active",
] as const;

type MarkupRuleEditableField = (typeof markupRuleEditableFields)[number];

export interface MarkupRuleRecord {
  id: string;
  scope: string;
  airline: string | null;
  channel: string | null;
  cabin: string | null;
  paxType: string | null;
  domesticInternational: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  markupType: "FIXED" | "PERCENT";
  markupValue: string;
  serviceFee: number;
  active: boolean;
  priority: number;
  createdAt: string;
}

export interface MarkupRuleUpdateResult {
  rule: MarkupRuleRecord;
  changedFields: MarkupRuleEditableField[];
  before: Partial<Record<MarkupRuleEditableField, string | number | boolean | null>>;
  after: Partial<Record<MarkupRuleEditableField, string | number | boolean | null>>;
}

type AuditFieldValue = string | number | boolean | null;
type AuditDiffPayload = Partial<Record<MarkupRuleEditableField, AuditFieldValue>>;

function toPlainDecimal(value: Prisma.Decimal | string): string {
  return value.toString();
}

function toMarkupRuleRecord(rule: MarkupRule): MarkupRuleRecord {
  return {
    id: rule.id,
    scope: rule.scope,
    airline: rule.airline,
    channel: rule.channel,
    cabin: rule.cabin,
    paxType: rule.paxType,
    domesticInternational: rule.domesticInternational,
    routeFrom: rule.routeFrom,
    routeTo: rule.routeTo,
    markupType: rule.markupType,
    markupValue: toPlainDecimal(rule.markupValue),
    serviceFee: rule.serviceFee,
    active: rule.active,
    priority: rule.priority,
    createdAt: rule.createdAt.toISOString(),
  };
}

function toAuditRuleRecord(rule: MarkupRuleRecord): Prisma.InputJsonObject {
  return { ...rule };
}

function buildAuditData(meta: AuditRequestMeta, payload: {
  actorId: string;
  entity: string;
  entityId: string;
  action: string;
  before?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  after?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}) {
  return {
    actorId: payload.actorId,
    entity: payload.entity,
    entityId: payload.entityId,
    action: payload.action,
    before: payload.before,
    after: payload.after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

function snapshotRule(rule: MarkupRule): Record<MarkupRuleEditableField, string | number | boolean | null> {
  return {
    scope: rule.scope,
    airline: rule.airline,
    channel: rule.channel,
    cabin: rule.cabin,
    paxType: rule.paxType,
    domesticInternational: rule.domesticInternational,
    routeFrom: rule.routeFrom,
    routeTo: rule.routeTo,
    markupType: rule.markupType,
    markupValue: toPlainDecimal(rule.markupValue),
    serviceFee: rule.serviceFee,
    priority: rule.priority,
    active: rule.active,
  };
}

function inputValueForAudit(
  field: MarkupRuleEditableField,
  value: MarkupRuleInput[MarkupRuleEditableField] | MarkupRulePatchInput[MarkupRuleEditableField],
): AuditFieldValue {
  if (value === undefined) {
    return null;
  }

  if (field === "markupValue" && value) {
    return toPlainDecimal(value as Prisma.Decimal | string);
  }

  return value as AuditFieldValue;
}

function isChanged(
  previousValue: AuditFieldValue,
  nextValue: AuditFieldValue,
): boolean {
  return previousValue !== nextValue;
}

function buildCreateData(input: MarkupRuleInput): Prisma.MarkupRuleCreateInput {
  return {
    scope: input.scope,
    airline: input.airline ?? null,
    channel: input.channel ?? null,
    cabin: input.cabin ?? null,
    paxType: input.paxType ?? null,
    domesticInternational: input.domesticInternational ?? null,
    routeFrom: input.routeFrom ?? null,
    routeTo: input.routeTo ?? null,
    markupType: input.markupType,
    markupValue: input.markupValue,
    serviceFee: input.serviceFee,
    active: input.active,
    priority: input.priority,
  };
}

function buildUpdateData(input: MarkupRulePatchInput): Prisma.MarkupRuleUpdateInput {
  const updateData: Prisma.MarkupRuleUpdateInput = {};

  if ("scope" in input && input.scope !== undefined) updateData.scope = input.scope;
  if ("airline" in input && input.airline !== undefined) updateData.airline = input.airline;
  if ("channel" in input && input.channel !== undefined) updateData.channel = input.channel;
  if ("cabin" in input && input.cabin !== undefined) updateData.cabin = input.cabin;
  if ("paxType" in input && input.paxType !== undefined) updateData.paxType = input.paxType;
  if ("domesticInternational" in input && input.domesticInternational !== undefined) {
    updateData.domesticInternational = input.domesticInternational;
  }
  if ("routeFrom" in input && input.routeFrom !== undefined) updateData.routeFrom = input.routeFrom;
  if ("routeTo" in input && input.routeTo !== undefined) updateData.routeTo = input.routeTo;
  if ("markupType" in input && input.markupType !== undefined) updateData.markupType = input.markupType;
  if ("markupValue" in input && input.markupValue !== undefined) updateData.markupValue = input.markupValue;
  if ("serviceFee" in input && input.serviceFee !== undefined) updateData.serviceFee = input.serviceFee;
  if ("priority" in input && input.priority !== undefined) updateData.priority = input.priority;
  if ("active" in input && input.active !== undefined) updateData.active = input.active;

  return updateData;
}

export async function listMarkupRules(filters: MarkupRuleListFilter): Promise<MarkupRuleRecord[]> {
  const rules = await prisma.markupRule.findMany({
    where: {
      ...(filters.active !== undefined ? { active: filters.active } : {}),
      ...(filters.airline ? { airline: filters.airline } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return rules.map(toMarkupRuleRecord);
}

export async function getMarkupRuleById(ruleId: string): Promise<MarkupRuleRecord | null> {
  const rule = await prisma.markupRule.findUnique({
    where: { id: ruleId },
  });

  return rule ? toMarkupRuleRecord(rule) : null;
}

export async function createMarkupRule(input: MarkupRuleInput, actorId: string, meta: AuditRequestMeta): Promise<MarkupRuleRecord> {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.markupRule.create({
      data: buildCreateData(input),
    });

    await tx.auditLog.create({
      data: buildAuditData(meta, {
        actorId,
        entity: "MarkupRule",
        entityId: rule.id,
        action: "markup_rule.create",
        after: toAuditRuleRecord(toMarkupRuleRecord(rule)),
      }),
    });

    return toMarkupRuleRecord(rule);
  });
}

export async function updateMarkupRule(
  ruleId: string,
  input: MarkupRulePatchInput,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<MarkupRuleUpdateResult> {
  return prisma.$transaction(async (tx) => {
    const existingRule = await tx.markupRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      throw new MarkupRuleNotFoundError(ruleId);
    }

    const beforeSnapshot = snapshotRule(existingRule);
    const before: AuditDiffPayload = {};
    const after: AuditDiffPayload = {};
    const changedFields: MarkupRuleEditableField[] = [];

    for (const field of markupRuleEditableFields) {
      if (!(field in input)) {
        continue;
      }

      const rawValue = input[field];

      if (rawValue === undefined) {
        continue;
      }

      const previousValue = beforeSnapshot[field];
      const nextValue = inputValueForAudit(field, rawValue);

      if (!isChanged(previousValue, nextValue)) {
        continue;
      }

      changedFields.push(field);
      before[field] = previousValue;
      after[field] = nextValue;
    }

    const updatedRule =
      changedFields.length > 0
        ? await tx.markupRule.update({
            where: { id: ruleId },
            data: buildUpdateData(input),
          })
        : existingRule;

    if (changedFields.length > 0) {
      await tx.auditLog.create({
        data: buildAuditData(meta, {
          actorId,
          entity: "MarkupRule",
          entityId: updatedRule.id,
          action: "markup_rule.update",
          before,
          after: {
            ...after,
            changedFields,
          },
        }),
      });
    }

    return {
      rule: toMarkupRuleRecord(updatedRule),
      changedFields,
      before,
      after,
    };
  });
}

/**
 * Hard delete: xoá hẳn rule khỏi DB. Audit log được giữ riêng (entity reference vẫn còn,
 * không bị FK constraint vì AuditLog không khoá FK đến MarkupRule).
 * Dùng khi admin click "Xóa" trên UI — match với expectation của user là xoá thật sự.
 */
export async function hardDeleteMarkupRule(ruleId: string, actorId: string, meta: AuditRequestMeta): Promise<MarkupRuleRecord> {
  return prisma.$transaction(async (tx) => {
    const existingRule = await tx.markupRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      throw new MarkupRuleNotFoundError(ruleId);
    }

    const beforeSnapshot = toAuditRuleRecord(toMarkupRuleRecord(existingRule));

    await tx.markupRule.delete({
      where: { id: ruleId },
    });

    await tx.auditLog.create({
      data: buildAuditData(meta, {
        actorId,
        entity: "MarkupRule",
        entityId: ruleId,
        action: "markup_rule.hard_delete",
        before: beforeSnapshot,
      }),
    });

    return toMarkupRuleRecord(existingRule);
  });
}

export async function softDeleteMarkupRule(ruleId: string, actorId: string, meta: AuditRequestMeta): Promise<MarkupRuleRecord> {
  return prisma.$transaction(async (tx) => {
    const existingRule = await tx.markupRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      throw new MarkupRuleNotFoundError(ruleId);
    }

    const rule =
      existingRule.active
        ? await tx.markupRule.update({
            where: { id: ruleId },
            data: { active: false },
          })
        : existingRule;

    await tx.auditLog.create({
      data: buildAuditData(meta, {
        actorId,
        entity: "MarkupRule",
        entityId: rule.id,
        action: "markup_rule.delete",
        before: { active: existingRule.active },
        after: { active: false },
      }),
    });

    return toMarkupRuleRecord(rule);
  });
}
