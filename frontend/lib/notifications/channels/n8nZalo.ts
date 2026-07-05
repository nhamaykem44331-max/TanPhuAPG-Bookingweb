// Gửi thông báo tới nhóm Zalo qua webhook n8n (workflow "Price Scan" → node ZaloUser).
// n8n đọc $json.body.content rồi forward sang nhóm Zalo, nên chỉ cần POST { content }.
// URL mặc định là webhook production của workflow; override bằng N8N_ZALO_WEBHOOK_URL.
// Tắt bằng NOTIFICATIONS_N8N_ZALO_ENABLED="false".
export interface N8nZaloMessage {
  content: string;
}

const DEFAULT_N8N_ZALO_WEBHOOK = "https://n8nhosting-72225366.phoai.vn/webhook/price-scan-zalo";

export function n8nZaloWebhookUrl(): string {
  return (process.env.N8N_ZALO_WEBHOOK_URL || DEFAULT_N8N_ZALO_WEBHOOK).trim();
}

export async function sendN8nZalo(message: N8nZaloMessage): Promise<void> {
  if (process.env.NOTIFICATIONS_N8N_ZALO_ENABLED === "false") {
    return;
  }

  const url = n8nZaloWebhookUrl();
  const content = String(message.content || "").trim();
  if (!url || !content) {
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, source: "tanphuapg" }),
    });

    if (!response.ok) {
      console.error(`n8n zalo webhook failed: HTTP ${response.status}`);
      return;
    }

    console.info("n8n zalo sent");
  } catch (error) {
    // Không throw: Zalo là kênh phụ, không được làm hỏng luồng thông báo chính.
    console.error("n8n zalo webhook error", error instanceof Error ? error.message : String(error));
  }
}
