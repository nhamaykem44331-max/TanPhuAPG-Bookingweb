import { NextResponse } from "next/server";
import { ChatChannel } from "@prisma/client";

import { processChatMessage } from "@/lib/chatbot/service";
import {
  isValidAnonId,
  isAllowedWebOrigin,
  ipRateLimited,
  WEB_MESSAGE_MAX_LENGTH,
} from "@/lib/chatbot/webGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cổng chatbot cho WIDGET WEB — public, KHÔNG dùng CHATBOT_WEBHOOK_SECRET (secret
 * nhúng vào browser là coi như lộ). Thay bằng 3 lớp: origin cùng site, anonId đúng
 * định dạng widget, rate-limit theo IP (cộng với rate-limit theo hội thoại ở service).
 * Body: { anonId, message }.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!isAllowedWebOrigin(origin, referer, host, process.env.NEXT_PUBLIC_SITE_URL)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // IP thật đứng đầu x-forwarded-for (Vercel set); fallback "unknown" gộp chung 1 bucket.
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (ipRateLimited(ip)) {
    return NextResponse.json(
      { reply: "Dạ hệ thống đang nhận nhiều tin quá, anh/chị thử lại sau ít phút giúp em nhé ạ." },
      { status: 429 },
    );
  }

  let body: { anonId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const anonId = String(body.anonId || "").trim();
  const userText = String(body.message || "").trim();
  if (!isValidAnonId(anonId) || !userText) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (userText.length > WEB_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({
      reply: "Dạ tin nhắn hơi dài, anh/chị tóm gọn giúp em trong vài câu để em hỗ trợ nhanh hơn nhé ạ.",
    });
  }

  const result = await processChatMessage({
    channel: ChatChannel.WEB,
    externalId: anonId,
    userText,
  });

  if (result.kind === "maintenance") {
    // Widget đọc cờ này để hiện fallback hotline/Zalo thay vì ô nhập.
    return NextResponse.json({ reply: result.reply, maintenance: true });
  }
  return NextResponse.json({ reply: result.reply });
}
