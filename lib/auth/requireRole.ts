import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export class AdminRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminRouteError";
    this.status = status;
  }
}

export async function requireRole(allowed: Role[]): Promise<Session> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AdminRouteError(401, "Chưa đăng nhập");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      active: true,
    },
  });

  if (!user) {
    throw new AdminRouteError(401, "Chưa đăng nhập");
  }

  if (!user.active) {
    throw new AdminRouteError(403, "Tài khoản đã bị khóa.");
  }

  if (!allowed.includes(user.role)) {
    throw new AdminRouteError(403, "Bạn không có quyền truy cập.");
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      active: user.active,
    },
  };
}

export function toAdminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
