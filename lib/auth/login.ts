import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getLoginRateLimitStatus, recordLoginFailure } from "@/lib/ratelimit";

export const loginInputSchema = z.object({
  email: z.string().trim().min(1).max(320).email(),
  password: z.string().min(1).max(128),
});

export type LoginAttemptResult =
  | {
      success: true;
      email: string;
    }
  | {
      success: false;
      code: "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "RATE_LIMITED";
      email: string;
      message: string;
      retryAfterSeconds?: number;
    };

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildRetryAfterMessage(retryAfterSeconds: number): string {
  const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Bạn đã thử quá nhiều lần, vui lòng chờ ${waitMinutes} phút.`;
}

export async function authenticateAdminLogin(input: {
  email: unknown;
  password: unknown;
  ip: string;
}): Promise<LoginAttemptResult> {
  const rawEmail = typeof input.email === "string" ? input.email : "";
  const normalizedEmail = normalizeLoginEmail(rawEmail);
  const bucketKey = `login:${input.ip}:${normalizedEmail || "unknown"}`;
  const rateLimitStatus = await getLoginRateLimitStatus(bucketKey);

  if (!rateLimitStatus.allowed) {
    return {
      success: false,
      code: "RATE_LIMITED",
      email: normalizedEmail,
      message: buildRetryAfterMessage(rateLimitStatus.retryAfterSeconds),
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
    };
  }

  const parsedInput = loginInputSchema.safeParse({
    email: input.email,
    password: input.password,
  });

  if (!parsedInput.success) {
    await recordLoginFailure(bucketKey);

    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      email: normalizedEmail,
      message: "Email hoặc mật khẩu không đúng.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeLoginEmail(parsedInput.data.email) },
    select: {
      email: true,
      active: true,
      passwordHash: true,
    },
  });

  if (!user) {
    await recordLoginFailure(bucketKey);

    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      email: normalizeLoginEmail(parsedInput.data.email),
      message: "Email hoặc mật khẩu không đúng.",
    };
  }

  const passwordMatches = await bcrypt.compare(parsedInput.data.password, user.passwordHash);

  if (!passwordMatches) {
    await recordLoginFailure(bucketKey);

    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      email: user.email,
      message: "Email hoặc mật khẩu không đúng.",
    };
  }

  if (!user.active) {
    return {
      success: false,
      code: "ACCOUNT_INACTIVE",
      email: user.email,
      message: "Tài khoản đã bị khóa.",
    };
  }

  return {
    success: true,
    email: user.email,
  };
}
