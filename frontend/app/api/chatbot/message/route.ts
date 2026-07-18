import { NextResponse } from "next/server";

import {
  normalizeChannel,
  processChatMessage,
} from "@/lib/chatbot/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cổng chatbot cho các kênh qua server trung gian (Zalo qua n8n, Messenger).
 * Body: { channel, externalId, message, name?, phone? }.
 * Bảo vệ bằng header x-chatbot-secret nếu đặt CHATBOT_WEBHOOK_SECRET.
 * Widget web KHÔNG gọi route này (secret không được lộ ra browser) — dùng /api/chatbot/web.
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

  const result = await processChatMessage({
    channel,
    externalId,
    userText,
    name: body.name,
    phone: body.phone,
  });

  // Giữ nguyên shape phản hồi cũ để n8n/Zalo v1 không phải đổi gì ngoài đọc `reply`.
  switch (result.kind) {
    case "maintenance":
      return NextResponse.json({ reply: result.reply, configured: false });
    case "rate_limited":
      return NextResponse.json({ reply: result.reply, rateLimited: true });
    case "engine_error":
      return NextResponse.json({ reply: result.reply, error: "ENGINE_ERROR" });
    case "ok":
      return NextResponse.json({ reply: result.reply, conversationId: result.conversationId });
  }
}
