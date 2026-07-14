import assert from "node:assert/strict";
import { test } from "node:test";

import { runChatTurn, type ChatEngineDeps } from "./engine";
import type { ChatChannel } from "@prisma/client";
import type { LlmContentBlock, LlmResponse, LlmUsage } from "./llm";

const ZERO_USAGE: LlmUsage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };
const WEB = "WEB" as ChatChannel;

function llmResponse(content: LlmContentBlock[], stopReason: string): LlmResponse {
  return { content, stopReason, usage: ZERO_USAGE, model: "fake" };
}

/** LLM giả: trả lần lượt các response đã kịch bản hoá. */
function scriptedLlm(responses: LlmResponse[]): ChatEngineDeps["llm"] {
  let i = 0;
  return async () => responses[Math.min(i++, responses.length - 1)];
}

test("engine: gọi công cụ rồi trả lời text", async () => {
  const executed: string[] = [];
  const deps: ChatEngineDeps = {
    llm: scriptedLlm([
      llmResponse(
        [{ type: "tool_use", id: "t1", name: "search_flights", input: { from: "HAN", to: "SGN", date: "2026-07-15" } }],
        "tool_use",
      ),
      llmResponse([{ type: "text", text: "Dạ có chuyến VN213 giá từ 1.850.000đ ạ." }], "end_turn"),
    ]),
    executeTool: async (name) => {
      executed.push(name);
      return JSON.stringify({ markupApplied: true, oneway: [] });
    },
  };

  const res = await runChatTurn(
    { channel: WEB, today: "2026-07-10", history: [], userText: "Vé HAN SGN 15/7 bao nhiêu?" },
    deps,
  );

  assert.deepEqual(executed, ["search_flights"]);
  assert.deepEqual(res.toolsUsed, ["search_flights"]);
  assert.equal(res.reply, "Dạ có chuyến VN213 giá từ 1.850.000đ ạ.");
  assert.equal(res.leaked, false);
  assert.equal(res.usage.inputTokens, 20); // 2 lượt gọi model
});

test("engine: che tên nhà cung cấp nếu model lỡ nhắc + báo cờ leaked", async () => {
  const deps: ChatEngineDeps = {
    llm: scriptedLlm([llmResponse([{ type: "text", text: "Em đang chờ Nam Thành trả PNR ạ." }], "end_turn")]),
    executeTool: async () => "{}",
  };

  const res = await runChatTurn(
    { channel: WEB, today: "2026-07-10", history: [], userText: "Vé của tôi sao rồi?" },
    deps,
  );

  assert.equal(res.leaked, true);
  assert.ok(!res.reply.toLowerCase().includes("nam thành"), "phải che 'Nam Thành'");
  assert.ok(res.reply.includes("đối tác"), "thay bằng 'đối tác'");
});

test("engine: lặp gọi công cụ quá số vòng → chuyển nhân viên", async () => {
  const deps: ChatEngineDeps = {
    // Luôn đòi gọi công cụ, không bao giờ trả text
    llm: async () =>
      llmResponse([{ type: "tool_use", id: "x", name: "search_flights", input: {} }], "tool_use"),
    executeTool: async () => "{}",
  };

  const res = await runChatTurn(
    { channel: WEB, today: "2026-07-10", history: [], userText: "..." },
    deps,
  );

  assert.ok(res.reply.includes("nhân viên"), "phải chuyển nhân viên khi lặp quá");
  assert.equal(res.toolsUsed.length, 4); // MAX_TOOL_ITERATIONS
});
