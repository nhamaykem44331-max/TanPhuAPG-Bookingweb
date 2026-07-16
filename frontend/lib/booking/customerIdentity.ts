export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerPhone(value: string | null | undefined): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0084")) return `0${digits.slice(4)}`;
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function customerPhoneVariants(value: string | null | undefined): string[] {
  const normalized = normalizeCustomerPhone(value);
  if (!normalized) return [];
  if (!normalized.startsWith("0")) return [normalized];
  const international = `84${normalized.slice(1)}`;
  return [normalized, international, `+${international}`];
}

export function customerIdentityWhere(contact: { email?: string | null; phone?: string | null }) {
  const email = normalizeCustomerEmail(contact.email);
  const phone = normalizeCustomerPhone(contact.phone);

  if (!email && !phone) return null;
  return { email, phone };
}
