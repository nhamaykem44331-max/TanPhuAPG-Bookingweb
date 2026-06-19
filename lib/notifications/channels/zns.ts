// Kênh khách hàng (Phần G): vé điện tử, hoàn tiền, không xuất được — gửi qua ZNS template.
// Cần template_id đã duyệt; tắt mặc định cho tới khi có access token.
export interface ZnsMessage {
  phone: string;
  templateId: string;
  templateData: Record<string, string>;
}

const DEFAULT_ZNS_API_URL = "https://business.openapi.zalo.me/message/template";

export function isZnsEnabled(): boolean {
  return process.env.NOTIFICATIONS_ZNS_ENABLED === "true" && !!process.env.ZNS_ACCESS_TOKEN;
}

// ZNS yêu cầu số điện thoại dạng 84xxxxxxxxx (bỏ số 0 đầu, không dấu +).
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("84")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `84${digits.slice(1)}`;
  }

  return digits;
}

export async function sendZns(message: ZnsMessage): Promise<void> {
  if (!isZnsEnabled()) {
    console.info("zns skipped");
    return;
  }

  const response = await fetch(process.env.ZNS_API_URL || DEFAULT_ZNS_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      access_token: process.env.ZNS_ACCESS_TOKEN as string,
    },
    body: JSON.stringify({
      phone: normalizePhone(message.phone),
      template_id: message.templateId,
      template_data: message.templateData,
    }),
  });

  if (!response.ok) {
    throw new Error(`zns failed: HTTP ${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as { error?: number; message?: string } | null;

  if (json && typeof json.error === "number" && json.error !== 0) {
    throw new Error(`zns error ${json.error}: ${json.message ?? "unknown"}`);
  }

  console.info("zns sent");
}
