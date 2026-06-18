// Kênh nội bộ chính (Phần G): cảnh báo cần xuất vé / quá SLA / sắp hết hạn / không xuất được.
// Gửi text tới Zalo OA. Tắt mặc định cho tới khi có access token + người nhận.
export interface ZaloOaMessage {
  text: string;
}

const DEFAULT_ZALO_OA_API_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";

export function isZaloOaEnabled(): boolean {
  return (
    process.env.NOTIFICATIONS_ZALO_ENABLED === "true" &&
    !!process.env.ZALO_OA_ACCESS_TOKEN &&
    !!process.env.ZALO_OA_RECIPIENT_ID
  );
}

export async function sendZaloOa(message: ZaloOaMessage): Promise<void> {
  if (!isZaloOaEnabled()) {
    console.info("zalo OA skipped");
    return;
  }

  const response = await fetch(process.env.ZALO_OA_API_URL || DEFAULT_ZALO_OA_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      access_token: process.env.ZALO_OA_ACCESS_TOKEN as string,
    },
    body: JSON.stringify({
      recipient: { user_id: process.env.ZALO_OA_RECIPIENT_ID },
      message: { text: message.text },
    }),
  });

  if (!response.ok) {
    throw new Error(`zalo OA failed: HTTP ${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as { error?: number; message?: string } | null;

  if (json && typeof json.error === "number" && json.error !== 0) {
    throw new Error(`zalo OA error ${json.error}: ${json.message ?? "unknown"}`);
  }

  console.info("zalo OA sent");
}
