"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { initialLoginFormState, type LoginFormState } from "@/app/admin/login/form-state";
import { authenticateAdminLogin } from "@/lib/auth/login";
import { getRequestIp, normalizeReturnTo } from "@/lib/auth/request";

export async function loginAction(_: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const result = await authenticateAdminLogin({
    email: formData.get("email"),
    password,
    ip: getRequestIp(),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.message,
      email: result.email,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  try {
    await signIn("credentials", {
      email: result.email,
      password,
      redirectTo: normalizeReturnTo(formData.get("returnTo")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        status: "error",
        message: "Email hoặc mật khẩu không đúng.",
        email: result.email,
      };
    }

    throw error;
  }

  return initialLoginFormState;
}
