// Pipeline xử lý 1 tin nhắn chatbot — dùng chung cho mọi cổng vào.
//
// /api/chatbot/message (n8n Zalo/Messenger, có secret) và /api/chatbot/web (widget
// trình duyệt, không secret) đều gọi processChatMessage(). Route chỉ lo phần HTTP
// (xác thực theo kênh, đọc body); toàn bộ nghiệp vụ nằm ở đây để 2 cổng không lệch nhau.

import { ChatChannel, ChatRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isChatbotConfigured } from "./llm";
import { runChatTurn } from "./engine";
import { containsSupplierLeak } from "./guardrail";
import { sendN8nZalo } from "@/lib/notifications/channels/n8nZalo";
import type { LlmMessage } from "./llm";

const HISTORY_LIMIT = 10;

export const MAINTENANCE_REPLY =
  "Dạ hệ thống chat đang bảo trì, anh/chị vui lòng để lại số điện thoại hoặc gọi hotline để được hỗ trợ nhanh nhất ạ.";
const RATE_LIMIT_REPLY =
  "Dạ anh/chị nhắn hơi nhanh, em xin phép xử lý từng tin một nhé ạ. Anh/chị chờ em chút xíu.";
const ENGINE_ERROR_REPLY =
  "Dạ em đang bận xử lý, anh/chị nhắn lại giúp em sau ít phút hoặc để lại SĐT để nhân viên gọi lại nhé ạ.";

// Chống lạm dụng theo HỘI THOẠI (không theo IP — bot server-side 1 IP sẽ khoá chéo khách).
// In-memory theo instance: đủ cho giai đoạn đầu, sau này cần chặt hơn thì chuyển RateLimitHit (DB).
const convoBucket = new Map<string, { count: number; resetAt: number }>();
const MSG_LIMIT = 30;
const MSG_WINDOW_MS = 10 * 60_000;

function convoRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = convoBucket.get(key);
  if (!entry || now > entry.resetAt) {
    convoBucket.set(key, { count: 1, resetAt: now + MSG_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MSG_LIMIT;
}

function todayInVN(): string {
  // YYYY-MM-DD theo Asia/Ho_Chi_Minh (không dùng UTC — tiền lệ bug giờ trong dự án).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA cho định dạng YYYY-MM-DD
}

export function normalizeChannel(value: unknown): ChatChannel | null {
  const v = String(value || "").toUpperCase();
  if (v === "ZALO" || v === "WEB" || v === "MESSENGER") return v as ChatChannel;
  return null;
}

export interface ProcessChatInput {
  channel: ChatChannel;
  /** Định danh khách theo kênh (Zalo threadId, web anonId, Messenger PSID). */
  externalId: string;
  userText: string;
  name?: string;
  phone?: string;
}

export type ProcessChatResult =
  | { kind: "maintenance"; reply: string }
  | { kind: "rate_limited"; reply: string }
  | { kind: "engine_error"; reply: string }
  | { kind: "ok"; reply: string; conversationId: string };

/** Xử lý trọn 1 tin: rate-limit → hội thoại → engine → lưu tin → cảnh báo rò rỉ. */
export async function processChatMessage(input: ProcessChatInput): Promise<ProcessChatResult> {
  // Chưa cấu hình (chưa có API key / chưa bật) → trả lời bảo trì thay vì lỗi.
  if (!isChatbotConfigured()) {
    return { kind: "maintenance", reply: MAINTENANCE_REPLY };
  }

  const bucketKey = `${input.channel}:${input.externalId}`;
  if (convoRateLimited(bucketKey)) {
    return { kind: "rate_limited", reply: RATE_LIMIT_REPLY };
  }

  // Tìm/tạo hội thoại theo (channel, externalId).
  const conversation = await prisma.chatConversation.upsert({
    where: { channel_externalId: { channel: input.channel, externalId: input.externalId } },
    create: {
      channel: input.channel,
      externalId: input.externalId,
      customerName: input.name?.trim() || null,
      customerPhone: input.phone?.trim() || null,
    },
    update: { lastMessageAt: new Date() },
  });

  // Lịch sử gần nhất → chuỗi lượt text cho model.
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  const history: LlmMessage[] = recent
    .reverse()
    .map((m) => ({ role: m.role === ChatRole.ASSISTANT ? "assistant" : "user", content: m.content }));

  let result;
  try {
    result = await runChatTurn({
      conversationId: conversation.id,
      channel: input.channel,
      today: todayInVN(),
      history,
      userText: input.userText,
    });
  } catch (error) {
    console.error("[chatbot/service] runChatTurn lỗi:", error);
    return { kind: "engine_error", reply: ENGINE_ERROR_REPLY };
  }

  // Lưu tin khách + tin bot (usage để canh ngân sách sau này).
  await prisma.chatMessage.createMany({
    data: [
      { conversationId: conversation.id, role: ChatRole.USER, content: input.userText },
      {
        conversationId: conversation.id,
        role: ChatRole.ASSISTANT,
        content: result.reply,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    ],
  });

  // Rò rỉ tên nhà cung cấp (đã che ở output) → cảnh báo nội bộ để rà lại prompt/dữ liệu.
  if (result.leaked || containsSupplierLeak(input.userText)) {
    sendN8nZalo({
      content: `⚠️ CHATBOT: phát hiện tên nhà cung cấp trong hội thoại ${bucketKey}. Rà lại prompt/dữ liệu.`,
    }).catch(() => {});
  }

  return { kind: "ok", reply: result.reply, conversationId: conversation.id };
}
