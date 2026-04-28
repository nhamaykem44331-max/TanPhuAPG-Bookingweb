import { headers } from "next/headers";

const DEFAULT_RETURN_TO = "/admin";

function readSingleValue(value: FormDataEntryValue | string | string[] | null | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

export function normalizeReturnTo(value: FormDataEntryValue | string | string[] | null | undefined): string {
  const candidate = readSingleValue(value)?.trim();

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }

  if (!candidate.startsWith("/admin")) {
    return DEFAULT_RETURN_TO;
  }

  return candidate;
}

export function getRequestIp(): string {
  const headerStore = headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "0.0.0.0";
  }

  const realIp = headerStore.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return "0.0.0.0";
}
