import { Prisma } from "@prisma/client";

import type { AuditRequestMeta } from "@/lib/audit";
import { prisma } from "@/lib/db";

export class CustomerMergeError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CustomerMergeError";
    this.status = status;
    this.code = code;
  }
}

export interface MergeCustomersResult {
  primary: {
    id: string;
    fullName: string;
    blacklisted: boolean;
  };
  mergedCount: number;
  bookingsMovedCount: number;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asPlainObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function hasMergedIntoId(value: Prisma.JsonValue | null): boolean {
  const tags = asPlainObject(value);
  return typeof tags.mergedIntoId === "string" && tags.mergedIntoId.length > 0;
}

function buildAuditData(
  meta: AuditRequestMeta,
  payload: {
    actorId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    after?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  },
) {
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

export async function mergeCustomers(
  primaryId: string,
  mergedCustomerIds: string[],
  actorId: string,
  meta: AuditRequestMeta,
): Promise<MergeCustomersResult> {
  if (mergedCustomerIds.includes(primaryId)) {
    throw new CustomerMergeError(422, "SELF_MERGE", "Không thể merge khách hàng vào chính nó.");
  }

  const uniqueMergedIds = Array.from(new Set(mergedCustomerIds));

  return prisma.$transaction(async (tx) => {
    const primary = await tx.customer.findUnique({
      where: { id: primaryId },
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!primary) {
      throw new CustomerMergeError(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng chính.");
    }

    if (primary.blacklisted) {
      throw new CustomerMergeError(409, "PRIMARY_BLACKLISTED", "Không thể merge vào khách hàng đang bị blacklist.");
    }

    const mergedCustomers = await tx.customer.findMany({
      where: {
        id: {
          in: uniqueMergedIds,
        },
      },
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (mergedCustomers.length !== uniqueMergedIds.length) {
      throw new CustomerMergeError(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy một hoặc nhiều khách hàng cần merge.");
    }

    const alreadyMerged = mergedCustomers.find((customer) => hasMergedIntoId(customer.tags));

    if (alreadyMerged) {
      throw new CustomerMergeError(409, "ALREADY_MERGED", `Khách hàng ${alreadyMerged.id} đã được merge trước đó.`);
    }

    const now = new Date();
    const beforePayload = {
      primaryId,
      mergedCustomers: mergedCustomers.map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        bookingCount: customer._count.bookings,
      })),
    };

    let bookingsMovedCount = 0;

    for (const customer of mergedCustomers) {
      const moved = await tx.booking.updateMany({
        where: { customerId: customer.id },
        data: { customerId: primaryId },
      });
      bookingsMovedCount += moved.count;

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          blacklisted: true,
          tags: toJsonValue({
            ...asPlainObject(customer.tags),
            mergedIntoId: primaryId,
            mergedAt: now.toISOString(),
            mergedBy: actorId,
          }),
        },
      });
    }

    await tx.auditLog.create({
      data: buildAuditData(meta, {
        actorId,
        entity: "Customer",
        entityId: primaryId,
        action: "customer.merge",
        before: toJsonValue(beforePayload),
        after: toJsonValue({
          primaryId,
          totalBookingsMoved: bookingsMovedCount,
          mergedIds: uniqueMergedIds,
        }),
      }),
    });

    const updatedPrimary = await tx.customer.findUniqueOrThrow({
      where: { id: primaryId },
      select: {
        id: true,
        fullName: true,
        blacklisted: true,
      },
    });

    return {
      primary: updatedPrimary,
      mergedCount: uniqueMergedIds.length,
      bookingsMovedCount,
    };
  });
}
