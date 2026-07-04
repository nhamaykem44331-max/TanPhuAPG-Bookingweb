import { Role, type Prisma } from "@prisma/client";

import type { AuditRequestMeta } from "@/lib/audit";
import { audit, buildAuditDiff } from "@/lib/audit/diff";
import { prisma } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/user/password";
import type { AdminUserCreateInput, AdminUserListQuery, AdminUserPatchInput } from "@/lib/users/schemas";

export class AdminUserError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AdminUserError";
    this.status = status;
    this.code = code;
  }
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListResult {
  items: AdminUserRecord[];
  total: number;
  limit: number;
  offset: number;
}

type UserModel = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

function toUserRecord(user: UserModel): AdminUserRecord {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

function buildWhere(query: AdminUserListQuery): Prisma.UserWhereInput {
  return {
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" as const } },
            { fullName: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.active !== undefined ? { active: query.active } : {}),
  };
}

function auditMeta(meta: AuditRequestMeta): { ip?: string } {
  return {
    ip: meta.ip ?? undefined,
  };
}

export async function listAdminUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
  const where = buildWhere(query);

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map(toUserRecord),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAdminUserById(userId: string): Promise<AdminUserRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return user ? toUserRecord(user) : null;
}

export async function createAdminUser(
  input: AdminUserCreateInput,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<{ user: AdminUserRecord; tempPassword: string }> {
  const tempPassword = input.tempPassword ?? generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new AdminUserError(409, "EMAIL_EXISTS", "Email này đã tồn tại.");
    }

    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        active: input.active,
      },
    });
    const record = toUserRecord(user);

    await audit(tx, {
      actorId,
      entity: "User",
      entityId: user.id,
      action: "user.create",
      diff: buildAuditDiff(null, {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        active: user.active,
      }),
      ...auditMeta(meta),
    });

    return {
      user: record,
      tempPassword,
    };
  });
}

export async function updateAdminUser(
  userId: string,
  input: AdminUserPatchInput,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<{ user: AdminUserRecord; changedFields: string[] }> {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new AdminUserError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    }

    if (userId === actorId && input.active === false) {
      throw new AdminUserError(422, "CANNOT_LOCK_SELF", "Super Admin không thể tự khóa chính mình.");
    }

    if (userId === actorId && input.role && input.role !== Role.SUPER_ADMIN) {
      throw new AdminUserError(422, "CANNOT_DOWNGRADE_SELF", "Super Admin không thể tự hạ role của chính mình.");
    }

    const wouldRemoveActiveSuperAdmin =
      existingUser.role === Role.SUPER_ADMIN &&
      existingUser.active &&
      ((input.role !== undefined && input.role !== Role.SUPER_ADMIN) || input.active === false);

    if (wouldRemoveActiveSuperAdmin) {
      const activeSuperAdminCount = await tx.user.count({
        where: {
          role: Role.SUPER_ADMIN,
          active: true,
        },
      });

      if (activeSuperAdminCount <= 1) {
        throw new AdminUserError(409, "LAST_SUPER_ADMIN", "Không được khóa hoặc hạ role Super Admin cuối cùng.");
      }
    }

    const before = {
      fullName: existingUser.fullName,
      role: existingUser.role,
      active: existingUser.active,
    };
    const after = {
      fullName: input.fullName ?? existingUser.fullName,
      role: input.role ?? existingUser.role,
      active: input.active ?? existingUser.active,
    };
    const diff = buildAuditDiff(before, after);

    const updatedUser =
      diff.changedFields.length > 0
        ? await tx.user.update({
            where: { id: userId },
            data: {
              ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
              ...(input.role !== undefined ? { role: input.role } : {}),
              ...(input.active !== undefined ? { active: input.active } : {}),
            },
          })
        : existingUser;

    if (diff.changedFields.length > 0) {
      await audit(tx, {
        actorId,
        entity: "User",
        entityId: userId,
        action: "user.update",
        diff,
        ...auditMeta(meta),
      });
    }

    return {
      user: toUserRecord(updatedUser),
      changedFields: diff.changedFields,
    };
  });
}

export async function resetAdminUserPassword(
  userId: string,
  actorId: string,
  meta: AuditRequestMeta,
): Promise<{ user: AdminUserRecord; tempPassword: string }> {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new AdminUserError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    const resetAt = new Date().toISOString();

    await audit(tx, {
      actorId,
      entity: "User",
      entityId: userId,
      action: "user.reset_password",
      diff: {
        before: { email: existingUser.email },
        after: {
          resetAt,
          resetBy: actorId,
        },
        changedFields: [],
      },
      ...auditMeta(meta),
    });

    return {
      user: toUserRecord(updatedUser),
      tempPassword,
    };
  });
}
