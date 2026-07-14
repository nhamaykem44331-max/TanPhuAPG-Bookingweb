// Định nghĩa công cụ (tool) cho model + bộ thực thi công cụ.
//
// Model chỉ thấy kết quả đã lọc: search trả SafeFlight/SafeRoundtripPair (không perPax/
// namthanh), lookup trả tập an toàn (không email/net). notify_staff lưu lead + báo Zalo n8n.

import type { Cabin, SearchPayload, TripType } from "@/lib/types";
import { prisma } from "@/lib/db";
import type { ChatChannel } from "@prisma/client";
import { searchFlightsForChat } from "./searchService";
import { lookupBookingForChat } from "./lookupService";
import { notifyChatbotLead } from "./leadNotify";
import type { LlmToolDef } from "./llm";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tanphuapg.com").replace(/\/+$/, "");

const CABINS: Cabin[] = ["economy", "premium", "business", "first"];

function toCabin(value: unknown): Cabin {
  const v = String(value || "economy").toLowerCase();
  return (CABINS as string[]).includes(v) ? (v as Cabin) : "economy";
}

function toInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function toSearchPayload(input: Record<string, unknown>): SearchPayload {
  const tripType: TripType = String(input.tripType || "oneway") === "roundtrip" ? "roundtrip" : "oneway";
  return {
    from: String(input.from || "").trim().toUpperCase(),
    to: String(input.to || "").trim().toUpperCase(),
    date: String(input.date || "").trim(),
    returnDate: input.returnDate ? String(input.returnDate).trim() : undefined,
    adults: Math.max(1, toInt(input.adults, 1)),
    children: Math.max(0, toInt(input.children, 0)),
    infants: Math.max(0, toInt(input.infants, 0)),
    cabin: toCabin(input.cabin),
    tripType,
  };
}

/** Link /dat-ve điền sẵn tiêu chí (cần bridge đọc URL params — Phase 0 sẽ ship sau). */
export function buildBookingUrl(p: SearchPayload): string {
  const q = new URLSearchParams({
    go: "1",
    from: p.from,
    to: p.to,
    date: p.date,
    adults: String(p.adults),
    children: String(p.children),
    infants: String(p.infants),
    cabin: p.cabin,
    tripType: p.tripType,
  });
  if (p.tripType === "roundtrip" && p.returnDate) q.set("returnDate", p.returnDate);
  return `${SITE_URL}/dat-ve?${q.toString()}`;
}

export const CHAT_TOOLS: LlmToolDef[] = [
  {
    name: "search_flights",
    description:
      "Tìm chuyến bay thật và lấy GIÁ BÁN (đã gồm phí) cho 1 người lớn. Dùng khi khách muốn biết giá/chuyến bay. Trả về danh sách chuyến an toàn và link đặt vé. Nếu markupApplied=false thì KHÔNG được báo giá cho khách.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Mã sân bay đi (IATA 3 ký tự, vd HAN)" },
        to: { type: "string", description: "Mã sân bay đến (IATA 3 ký tự, vd SGN)" },
        date: { type: "string", description: "Ngày đi YYYY-MM-DD" },
        returnDate: { type: "string", description: "Ngày về YYYY-MM-DD (chỉ khi khứ hồi)" },
        adults: { type: "integer", description: "Số người lớn (>=1)" },
        children: { type: "integer", description: "Số trẻ em 2-11 tuổi" },
        infants: { type: "integer", description: "Số em bé <2 tuổi ngồi cùng người lớn" },
        cabin: { type: "string", enum: CABINS, description: "Hạng ghế" },
        tripType: { type: "string", enum: ["oneway", "roundtrip"], description: "Một chiều hay khứ hồi" },
      },
      required: ["from", "to", "date"],
    },
  },
  {
    name: "lookup_booking",
    description:
      "Tra cứu trạng thái đơn đã đặt bằng mã đơn và số điện thoại. Dùng khi khách hỏi về đơn của họ, tình trạng thanh toán, hạn giữ chỗ. Cần cả mã đơn và SĐT; nếu không khớp trả found=false.",
    input_schema: {
      type: "object",
      properties: {
        orderCode: { type: "string", description: "Mã đơn, vd APG-260512-A1B2C3" },
        phone: { type: "string", description: "Số điện thoại khách đã dùng khi đặt" },
      },
      required: ["orderCode", "phone"],
    },
  },
  {
    name: "notify_staff",
    description:
      "Chuyển thông tin cho nhân viên gọi lại. Dùng khi khách muốn gặp người, câu hỏi vượt khả năng, đoàn phức tạp/quốc tế, hoặc không báo được giá. Nên xin tên và SĐT khách trước khi gọi.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên khách" },
        phone: { type: "string", description: "SĐT khách để gọi lại" },
        topic: { type: "string", description: "Nhu cầu ngắn gọn" },
        summary: { type: "string", description: "Tóm tắt hội thoại cho nhân viên" },
      },
      required: ["phone"],
    },
  },
];

export interface ToolContext {
  conversationId?: string;
  channel: ChatChannel;
}

/** Thực thi 1 tool call, trả về chuỗi JSON để đưa lại cho model. Không bao giờ throw. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  try {
    if (name === "search_flights") {
      const payload = toSearchPayload(input);
      const result = await searchFlightsForChat(payload);
      return JSON.stringify({
        ...result,
        bookingUrl: buildBookingUrl(payload),
        priceNote: result.markupApplied
          ? "Giá là GIÁ BÁN cho 1 người lớn. Với đoàn có trẻ em/em bé, báo 'giá từ X/người lớn' và mời khách bấm link đặt để hệ thống tính đúng tổng."
          : "markupApplied=false: KHÔNG báo giá cho khách. Xin SĐT và dùng notify_staff.",
      });
    }

    if (name === "lookup_booking") {
      const result = await lookupBookingForChat(String(input.orderCode || ""), String(input.phone || ""));
      return JSON.stringify(result);
    }

    if (name === "notify_staff") {
      const name_ = input.name ? String(input.name).trim() : undefined;
      const phone = input.phone ? String(input.phone).trim() : undefined;
      const topic = input.topic ? String(input.topic).trim() : undefined;
      const summary = input.summary ? String(input.summary).trim() : undefined;
      const channel = ctx.channel;

      // Lưu lead (best-effort) + cập nhật tên/SĐT vào hội thoại.
      try {
        await prisma.chatLead.create({
          data: { conversationId: ctx.conversationId ?? null, channel, name: name_, phone, topic, summary },
        });
        if (ctx.conversationId && (name_ || phone)) {
          await prisma.chatConversation.update({
            where: { id: ctx.conversationId },
            data: { customerName: name_, customerPhone: phone },
          });
        }
      } catch (dbError) {
        console.error("[chatbot/tools] lưu lead thất bại:", dbError);
      }

      await notifyChatbotLead({ name: name_, phone, topic, summary, channel: channel.toLowerCase() });
      return JSON.stringify({ ok: true });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (error) {
    console.error(`[chatbot/tools] executeTool(${name}) lỗi:`, error);
    return JSON.stringify({ error: "TOOL_FAILED" });
  }
}
