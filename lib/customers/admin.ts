import { Prisma, type Customer } from "@prisma/client";

import type { AuditRequestMeta } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AdminCustomerInput, AdminCustomerListQuery, AdminCustomerPatchInput } from "@/lib/customers/schemas";

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Không tìm thấy khách hàng ${customerId}.`);
    this.name = "CustomerNotFoundError";
  }
}

const customerEditableFields = [
  "fullName",
  "phone",
  "email",
  "idNumber",
  "passport",
  "dob",
  "tags",
  "blacklisted",
] as const;

type CustomerEditableField = (typeof customerEditableFields)[number];
type CustomerAuditValue = string | number | boolean | Prisma.JsonValue | null;
type CustomerAuditDiff = Partial<Record<CustomerEditableField, CustomerAuditValue>>;

export interface AdminCustomerRecord {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  passport: string | null;
  bookingCount: number;
  blacklisted: boolean;
  createdAt: string;
}

export interface AdminCustomerBooking {
  id: string;
  pnr: string | null;
  status: string;
  routeSummary: string;
  saleAmount: number;
  currency: string;
  createdAt: string;
}

export interface AdminCustomerDetail {
  customer: AdminCustomerDetailRecord;
  bookings: AdminCustomerBooking[];
}

export interface AdminCustomerDetailRecord extends AdminCustomerRecord {
  dob: string | null;
  tags: Prisma.JsonValue | null;
  createdById: string | null;
}

export interface AdminCustomerListResult {
  items: AdminCustomerRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomerUpdateResult {
  customer: AdminCustomerDetailRecord;
  changedFields: CustomerEditableField[];
  before: CustomerAuditDiff;
  after: CustomerAuditDiff;
}

type CustomerListModel = Prisma.CustomerGetPayload<{
  include: {
    _count: {
      select: {
        bookings: true;
      };
    };
  };
}>;

type CustomerDetailModel = Prisma.CustomerGetPayload<{
  include: {
    _count: {
      select: {
        bookings: true;
      };
    };
    bookings: {
      select: {
        id: true;
        pnr: true;
        status: true;
        routeSummary: true;
        saleAmount: true;
        currency: true;
        createdAt: true;
      };
    };
  };
}>;

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+07:00`);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : toJsonValue(value);
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

function formatDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toCustomerRecord(customer: CustomerListModel): AdminCustomerRecord {
  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    idNumber: customer.idNumber,
    passport: customer.passport,
    bookingCount: customer._count.bookings,
    blacklisted: customer.blacklisted,
    createdAt: customer.createdAt.toISOString(),
  };
}

function toCustomerDetailRecord(customer: CustomerDetailModel): AdminCustomerDetailRecord {
  return {
    ...toCustomerRecord(customer),
    dob: formatDateOnly(customer.dob),
    tags: customer.tags,
    createdById: customer.createdById,
  };
}

function toCustomerBooking(booking: CustomerDetailModel["bookings"][number]): AdminCustomerBooking {
  return {
    id: booking.id,
    pnr: booking.pnr,
    status: booking.status,
    routeSummary: booking.routeSummary,
    saleAmount: booking.saleAmount,
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
  };
}

function buildWhere(query: AdminCustomerListQuery): Prisma.CustomerWhereInput {
  return {
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.blacklisted !== undefined ? { blacklisted: query.blacklisted } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: startOfDay(query.from) } : {}),
            ...(query.to ? { lte: endOfDay(query.to) } : {}),
          },
        }
      : {}),
  };
}

function buildCreateData(input: AdminCustomerInput, actorId: string): Prisma.CustomerCreateInput {
  return {
    fullName: input.fullName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    idNumber: input.idNumber ?? null,
    passport: input.passport ?? null,
    dob: input.dob ? new Date(`${input.dob}T00:00:00+07:00`) : null,
    tags: input.tags === undefined ? undefined : toNullableJsonInput(input.tags),
    blacklisted: input.blacklisted,
    createdBy: {
      connect: {
        id: actorId,
      },
    },
  };
}

function buildUpdateData(input: AdminCustomerPatchInput): Prisma.CustomerUpdateInput {
  const data: Prisma.CustomerUpdateInput = {};

  if ("fullName" in input && input.fullName !== undefined) data.fullName = input.fullName;
  if ("phone" in input && input.phone !== undefined) data.phone = input.phone;
  if ("email" in input && input.email !== undefined) data.email = input.email;
  if ("idNumber" in input && input.idNumber !== undefined) data.idNumber = input.idNumber;
  if ("passport" in input && input.passport !== undefined) data.passport = input.passport;
  if ("dob" in input && input.dob !== undefined) data.dob = input.dob ? new Date(`${input.dob}T00:00:00+07:00`) : null;
  if ("tags" in input && input.tags !== undefined) data.tags = toNullableJsonInput(input.tags);
  if ("blacklisted" in input && input.blacklisted !== undefined) data.blacklisted = input.blacklisted;

  return data;
}

function snapshotCustomer(customer: Customer): Record<CustomerEditableField, CustomerAuditValue> {
  return {
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    idNumber: customer.idNumber,
    passport: customer.passport,
    dob: formatDateOnly(customer.dob),
    tags: customer.tags,
    blacklisted: customer.blacklisted,
  };
}

function inputValueForAudit(field: CustomerEditableField, value: AdminCustomerPatchInput[CustomerEditableField]): CustomerAuditValue {
  if (field === "dob") {
    return (value as string | null | undefined) ?? null;
  }

  if (field === "tags") {
    return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as Prisma.JsonValue | null);
  }

  return (value ?? null) as CustomerAuditValue;
}

function isChanged(previousValue: CustomerAuditValue, nextValue: CustomerAuditValue): boolean {
  return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
}

export async function listAdminCustomers(query: AdminCustomerListQuery): Promise<AdminCustomerListResult> {
  const where = buildWhere(query);

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    items: items.map(toCustomerRecord),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAdminCustomerById(customerId: string): Promise<AdminCustomerDetail | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      _count: {
        select: {
          bookings: true,
        },
      },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          pnr: true,
          status: true,
          routeSummary: true,
          saleAmount: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  return {
    customer: toCustomerDetailRecord(customer),
    bookings: customer.bookings.map(toCustomerBooking),
  };
}

export async function createAdminCustomer(
  input: AdminCustomerInput,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<AdminCustomerDetailRecord> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: buildCreateData(input, actorId),
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
        bookings: {
          select: {
            id: true,
            pnr: true,
            status: true,
            routeSummary: true,
            saleAmount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    });

    const record = toCustomerDetailRecord(customer);

    await tx.auditLog.create({
      data: buildAuditData(meta, {
        actorId,
        entity: "Customer",
        entityId: customer.id,
        action: "customer.create",
        before: Prisma.JsonNull,
        after: toJsonValue(record),
      }),
    });

    return record;
  });
}

export async function updateAdminCustomer(
  customerId: string,
  input: AdminCustomerPatchInput,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<CustomerUpdateResult> {
  return prisma.$transaction(async (tx) => {
    const existingCustomer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer) {
      throw new CustomerNotFoundError(customerId);
    }

    const beforeSnapshot = snapshotCustomer(existingCustomer);
    const before: CustomerAuditDiff = {};
    const after: CustomerAuditDiff = {};
    const changedFields: CustomerEditableField[] = [];

    for (const field of customerEditableFields) {
      if (!(field in input)) {
        continue;
      }

      const rawValue = input[field];

      if (rawValue === undefined) {
        continue;
      }

      const nextValue = inputValueForAudit(field, rawValue);

      if (!isChanged(beforeSnapshot[field], nextValue)) {
        continue;
      }

      changedFields.push(field);
      before[field] = beforeSnapshot[field];
      after[field] = nextValue;
    }

    const updatedCustomer =
      changedFields.length > 0
        ? await tx.customer.update({
            where: { id: customerId },
            data: buildUpdateData(input),
            include: {
              _count: {
                select: {
                  bookings: true,
                },
              },
              bookings: {
                select: {
                  id: true,
                  pnr: true,
                  status: true,
                  routeSummary: true,
                  saleAmount: true,
                  currency: true,
                  createdAt: true,
                },
              },
            },
          })
        : await tx.customer.findUniqueOrThrow({
            where: { id: customerId },
            include: {
              _count: {
                select: {
                  bookings: true,
                },
              },
              bookings: {
                select: {
                  id: true,
                  pnr: true,
                  status: true,
                  routeSummary: true,
                  saleAmount: true,
                  currency: true,
                  createdAt: true,
                },
              },
            },
          });

    if (changedFields.length > 0) {
      await tx.auditLog.create({
        data: buildAuditData(meta, {
          actorId,
          entity: "Customer",
          entityId: customerId,
          action: "customer.update",
          before: toJsonValue(before),
          after: toJsonValue({
            ...after,
            changedFields,
          }),
        }),
      });
    }

    return {
      customer: toCustomerDetailRecord(updatedCustomer),
      changedFields,
      before,
      after,
    };
  });
}
