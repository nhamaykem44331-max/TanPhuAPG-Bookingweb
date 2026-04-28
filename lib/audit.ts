import { headers } from "next/headers";

export interface AuditRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function getAuditRequestMeta(): AuditRequestMeta {
  try {
    const headerStore = headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const realIp = headerStore.get("x-real-ip");

    return {
      ip: forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null,
      userAgent: headerStore.get("user-agent"),
    };
  } catch {
    return {
      ip: null,
      userAgent: null,
    };
  }
}
