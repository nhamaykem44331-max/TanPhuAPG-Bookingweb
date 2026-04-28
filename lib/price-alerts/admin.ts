import { PriceAlertDir, PriceAlertStatus, Prisma, type PriceAlert } from "@prisma/client";

import type { AuditRequestMeta } from "@/lib/audit";
import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import type { PriceAlertInput, PriceAlertListQuery, PriceAlertPatchInput } from "@/lib/price-alerts/schemas";

export class PriceAlertError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PriceAlertError";
    this.status = status;
    this.code = code;
  }
}

export interface PriceAlertRecord {
  id: string;
  route: string;
  airline: string | null;
  targetPrice: number;
  direction: PriceAlertDir;
  status: PriceAlertStatus;
  triggeredAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface PriceAlertListResult {
  items: PriceAlertRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface TriggerPriceAlertInput {
  route: string;
  airline?: string | null;
  price: number;
  flightNumber?: string;
  travelDate?: string;
}

export interface TriggeredPriceAlert {
  id: string;
  route: string;
  airline: string | null;
  targetPrice: number;
  direction: PriceAlertDir;
  price: number;
}

type PriceAlertWithUser = Prisma.PriceAlertGetPayload<{
  include: {
    createdBy: {
      select: {
        id: true;
        email: true;
        fullName: true;
      };
    };
  };
}>;

function toJsonRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function toRecord(alert: PriceAlertWithUser): PriceAlertRecord {
  return {
    id: alert.id,
    route: alert.route,
    airline: alert.airline,
    targetPrice: alert.targetPrice,
    direction: alert.direction,
    status: alert.status,
    triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
    createdAt: alert.createdAt.toISOString(),
    createdBy: alert.createdBy,
  };
}

function auditMeta(meta?: AuditRequestMeta): { ip?: string } {
  return {
    ip: meta?.ip ?? undefined,
  };
}

function buildWhere(query: PriceAlertListQuery): Prisma.PriceAlertWhereInput {
  return {
    ...(query.q ? { route: { contains: query.q.toUpperCase(), mode: "insensitive" as const } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.airline ? { airline: query.airline } : {}),
  };
}

function priceHitsAlert(alert: Pick<PriceAlert, "direction" | "targetPrice">, price: number): boolean {
  if (alert.direction === PriceAlertDir.BELOW) {
    return price <= alert.targetPrice;
  }

  return price >= alert.targetPrice;
}

export async function listPriceAlerts(query: PriceAlertListQuery): Promise<PriceAlertListResult> {
  const where = buildWhere(query);

  const [items, total] = await Promise.all([
    prisma.priceAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.priceAlert.count({ where }),
  ]);

  return {
    items: items.map(toRecord),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getPriceAlertById(alertId: string): Promise<PriceAlertRecord | null> {
  const alert = await prisma.priceAlert.findUnique({
    where: { id: alertId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  return alert ? toRecord(alert) : null;
}

export async function createPriceAlert(
  input: PriceAlertInput,
  actorId: string,
  meta?: AuditRequestMeta,
): Promise<PriceAlertRecord> {
  return prisma.$transaction(async (tx) => {
    const alert = await tx.priceAlert.create({
      data: {
        route: input.route,
        airline: input.airline ?? null,
        targetPrice: input.targetPrice,
        direction: input.direction,
        createdById: actorId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
    const record = toRecord(alert);

    await audit(tx, {
      actorId,
      entity: "PriceAlert",
      entityId: alert.id,
      action: "price_alert.create",
      diff: buildAuditDiff(null, toJsonRecord(record)),
      ...auditMeta(meta),
    });

    return record;
  });
}

export async function updatePriceAlertStatus(
  alertId: string,
  input: PriceAlertPatchInput,
  actorId: string,
  meta?: AuditRequestMeta,
): Promise<{ alert: PriceAlertRecord; changedFields: string[] }> {
  return prisma.$transaction(async (tx) => {
    const existingAlert = await tx.priceAlert.findUnique({
      where: { id: alertId },
    });

    if (!existingAlert) {
      throw new PriceAlertError(404, "PRICE_ALERT_NOT_FOUND", "Không tìm thấy price alert.");
    }

    const before = {
      status: existingAlert.status,
    };
    const after = {
      status: input.status,
    };
    const diff = buildAuditDiff(before, after);

    const alert =
      diff.changedFields.length > 0
        ? await tx.priceAlert.update({
            where: { id: alertId },
            data: {
              status: input.status,
              triggeredAt: input.status === PriceAlertStatus.ACTIVE ? null : existingAlert.triggeredAt,
            },
            include: {
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          })
        : await tx.priceAlert.findUniqueOrThrow({
            where: { id: alertId },
            include: {
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          });

    if (diff.changedFields.length > 0) {
      await audit(tx, {
        actorId,
        entity: "PriceAlert",
        entityId: alertId,
        action: "price_alert.update",
        diff,
        ...auditMeta(meta),
      });
    }

    return {
      alert: toRecord(alert),
      changedFields: diff.changedFields,
    };
  });
}

export async function softDeletePriceAlert(alertId: string, actorId: string, meta?: AuditRequestMeta): Promise<void> {
  await updatePriceAlertStatus(alertId, { status: PriceAlertStatus.DISABLED }, actorId, meta);
}

export async function triggerMatchingPriceAlerts(input: TriggerPriceAlertInput): Promise<TriggeredPriceAlert[]> {
  const airline = input.airline?.trim().toUpperCase() || null;
  const route = input.route.trim().toUpperCase();
  const candidates = await prisma.priceAlert.findMany({
    where: {
      route,
      status: PriceAlertStatus.ACTIVE,
      OR: [{ airline: null }, ...(airline ? [{ airline }] : [])],
    },
  });
  const matchingAlerts = candidates.filter((alert) => priceHitsAlert(alert, input.price));

  if (matchingAlerts.length === 0) {
    return [];
  }

  const triggered = await prisma.$transaction(async (tx) => {
    const rows: TriggeredPriceAlert[] = [];
    const now = new Date();

    for (const alert of matchingAlerts) {
      const current = await tx.priceAlert.findUnique({
        where: { id: alert.id },
      });

      if (!current || current.status !== PriceAlertStatus.ACTIVE) {
        continue;
      }

      const updated = await tx.priceAlert.update({
        where: { id: alert.id },
        data: {
          status: PriceAlertStatus.TRIGGERED,
          triggeredAt: now,
        },
      });

      await audit(tx, {
        actorId: null,
        entity: "PriceAlert",
        entityId: alert.id,
        action: "price_alert.trigger",
        diff: buildAuditDiff(
          {
            status: current.status,
            triggeredAt: current.triggeredAt ? current.triggeredAt.toISOString() : null,
          },
          {
            status: updated.status,
            triggeredAt: updated.triggeredAt ? updated.triggeredAt.toISOString() : null,
          },
        ),
      });

      rows.push({
        id: updated.id,
        route: updated.route,
        airline: updated.airline,
        targetPrice: updated.targetPrice,
        direction: updated.direction,
        price: input.price,
      });
    }

    return rows;
  });

  for (const alert of triggered) {
    void notify({
      type: "INTERNAL_ALERT",
      severity: "info",
      message: `Giá vé ${alert.route} đạt ngưỡng ${alert.targetPrice.toLocaleString("vi-VN")} VND`,
      context: {
        alertId: alert.id,
        route: alert.route,
        airline: alert.airline,
        direction: alert.direction,
        targetPrice: alert.targetPrice,
        price: alert.price,
        flightNumber: input.flightNumber,
        travelDate: input.travelDate,
      },
    });
  }

  return triggered;
}
