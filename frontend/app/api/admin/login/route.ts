import { NextResponse } from "next/server";

import { authenticateAdminLogin } from "@/lib/auth/login";
import { getRequestIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const result = await authenticateAdminLogin({
    email: body?.email,
    password: body?.password,
    ip: getRequestIp(),
  });

  if (!result.success) {
    if (result.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: result.message },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds ?? 0),
          },
        },
      );
    }

    return NextResponse.json(
      { error: result.message },
      {
        status: result.code === "ACCOUNT_INACTIVE" ? 403 : 401,
      },
    );
  }

  return NextResponse.json({ success: true });
}
