import { NextResponse } from "next/server";
import { ChatChannel, ChatRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isChatbotConfigured } from "@/lib/chatbot/llm";
import { runChatTurn } from "@/lib/chatbot/engine";
import { containsSupplierLeak } from "@/lib/chatbot/guardrail";
import { sendN8nZalo } from "@/lib/notifications/channels/n8nZalo";
import type { LlmMessage } from "@/lib/chatbot/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HISTORY_LIMIT = 10;
const MAINTENANCE_REPLY =
  "Dạ hệ thống chat đang bảo trì, anh/chị vui lòng để lại số điện thoại hoặc gọi hotline để được hỗ trợ nhanh nhất ạ.";

// Chống lạm dụng theo HỘI THOẠI (không theo IP — bot 1 IP sẽ khoá chéo khách).
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA cho định dạng YYYY-MM-DD
}

function normalizeChannel(value: unknown): ChatChannel | null {
  const v = String(value || "").toUpperCase();
  if (v === "ZALO" || v === "WEB" || v === "MESSENGER") return v as ChatChannel;
  return null;
}

/**
 * Cổng chatbot chung cho mọi kênh (Zalo qua n8n, web widget, Messenger).
 * Body: { channel, externalId, message, name?, phone? }.
 * Bảo vệ bằng header x-chatbot-secret nếu đặt CHATBOT_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.CHATBOT_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-chatbot-secret") !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { channel?: string; externalId?: string; message?: string; name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const channel = normalizeChannel(body.channel);
  const externalId = String(body.externalId || "").trim();
  const userText = String(body.message || "").trim();
  if (!channel || !externalId || !userText) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  // Chưa cấu hình (chưa có API key / chưa bật) → trả lời bảo trì thay vì lỗi.
  if (!isChatbotConfigured()) {
    return NextResponse.json({ reply: MAINTENANCE_REPLY, configured: false });
  }

  const bucketKey = `${channel}:${externalId}`;
  if (convoRateLimited(bucketKey)) {
    return NextResponse.json({
      reply: "Dạ anh/chị nhắn hơi nhanh, em xin phép xử lý từng tin một nhé ạ. Anh/chị chờ em chút xíu.",
      rateLimited: true,
    });
  }

  // Tìm/tạo hội thoại theo (channel, externalId).
  const conversation = await prisma.chatConversation.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { channel, externalId, customerName: body.name?.trim() || null, customerPhone: body.phone?.trim() || null },
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
      channel,
      today: todayInVN(),
      history,
      userText,
    });
  } catch (error) {
    console.error("[chatbot/message] runChatTurn lỗi:", error);
    return NextResponse.json({
      reply: "Dạ em đang bận xử lý, anh/chị nhắn lại giúp em sau ít phút hoặc để lại SĐT để nhân viên gọi lại nhé ạ.",
      error: "ENGINE_ERROR",
    });
  }

  // Lưu tin khách + tin bot (usage để canh ngân sách sau này).
  await prisma.chatMessage.createMany({
    data: [
      { conversationId: conversation.id, role: ChatRole.USER, content: userText },
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
  if (result.leaked || containsSupplierLeak(userText)) {
    sendN8nZalo({
      content: `⚠️ CHATBOT: phát hiện tên nhà cung cấp trong hội thoại ${bucketKey}. Rà lại prompt/dữ liệu.`,
    }).catch(() => {});
  }

  return NextResponse.json({ reply: result.reply, conversationId: conversation.id });
}
