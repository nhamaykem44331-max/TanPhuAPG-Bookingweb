// Báo lead từ chatbot cho nhân viên — tái dùng kênh Zalo n8n sẵn có (miễn phí).
// Text thuần, không markdown (Zalo không render). Không throw: báo lead là phụ,
// không được làm hỏng luồng trả lời khách.

import { sendN8nZalo } from "@/lib/notifications/channels/n8nZalo";

export interface ChatbotLead {
  name?: string;
  phone?: string;
  /** Nhu cầu ngắn gọn, vd "Đặt vé đoàn HAN-SGN 15/7, 6 khách". */
  topic?: string;
  /** Tóm tắt hội thoại để nhân viên gọi lại nắm ngữ cảnh. */
  summary?: string;
  /** Kênh khách đang chat: 'zalo' | 'web' | 'messenger'. */
  channel?: string;
}

function channelLabel(channel?: string): string {
  switch ((channel || "").toLowerCase()) {
    case "zalo":
      return "Zalo";
    case "web":
      return "Web (tanphuapg.com)";
    case "messenger":
      return "Facebook Messenger";
    default:
      return channel || "Chatbot";
  }
}

export function renderChatbotLead(lead: ChatbotLead): string {
  const lines = [
    "🔔 LEAD MỚI TỪ CHATBOT",
    `Kênh: ${channelLabel(lead.channel)}`,
    `Tên: ${lead.name?.trim() || "(khách chưa cho tên)"}`,
    `SĐT: ${lead.phone?.trim() || "(chưa có)"}`,
  ];
  if (lead.topic?.trim()) lines.push(`Nhu cầu: ${lead.topic.trim()}`);
  if (lead.summary?.trim()) lines.push(`Tóm tắt: ${lead.summary.trim()}`);
  lines.push("→ Vui lòng gọi lại khách sớm.");
  return lines.join("\n");
}

export async function notifyChatbotLead(lead: ChatbotLead): Promise<void> {
  try {
    await sendN8nZalo({ content: renderChatbotLead(lead) });
  } catch (error) {
    console.error(
      "[chatbot/leadNotify] gửi lead thất bại:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
