import { Prisma } from "@prisma/client";

export interface AuditDiffPayload {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pickChangedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldsToTrack?: (keyof T)[],
): string[] {
  const fields = fieldsToTrack ?? Array.from(new Set([...Object.keys(before), ...Object.keys(after)])) as (keyof T)[];

  return fields.filter((field) => !valuesEqual(before[field], after[field])).map(String);
}

export function buildAuditDiff<T extends Record<string, unknown>>(
  before: T | null,
  after: T | null,
  fieldsToTrack?: (keyof T)[],
): AuditDiffPayload {
  if (before === null || after === null) {
    return {
      before,
      after,
      changedFields: [],
    };
  }

  const changedFields = pickChangedFields(before, after, fieldsToTrack);
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};

  for (const field of changedFields) {
    beforeDiff[field] = before[field];
    afterDiff[field] = after[field];
  }

  return {
    before: beforeDiff,
    after: afterDiff,
    changedFields,
  };
}

export async function audit(
  tx: Prisma.TransactionClient,
  args: {
    actorId: string | null;
    entity: string;
    entityId: string;
    action: string;
    diff: AuditDiffPayload;
    ip?: string;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: args.actorId,
      entity: args.entity,
      entityId: args.entityId,
      action: args.action,
      before: args.diff.before === null ? Prisma.JsonNull : toJsonValue(args.diff.before),
      after:
        args.diff.after === null
          ? Prisma.JsonNull
          : toJsonValue({
              ...args.diff.after,
              changedFields: args.diff.changedFields,
            }),
      ip: args.ip,
    },
  });
}
