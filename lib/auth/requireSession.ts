import type { Session } from "next-auth";

import { ADMIN_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";

export async function requireAdminSession(): Promise<Session> {
  return requireRole(ADMIN_ROLES);
}
