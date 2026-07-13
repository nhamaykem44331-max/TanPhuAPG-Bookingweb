import assert from "node:assert/strict";
import { test, afterEach } from "node:test";

import { callOpenAiCompatible, type LlmCallOptions } from "./llm";

// ─── Tiện ích: bơm fetch giả + đặt env cho provider openai ────────────────────

const realFetch = globalThis.fetch;

function stubFetch(response: unknown, status = 200): { calls: { url: string; body: any }[] } {
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(response),
    } as Response;
  }) as typeof fetch;
  return { calls };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.CHATBOT_API_KEY;
  delete process.env.CHATBOT_BASE_URL;
  delete process.env.CHATBOT_TEMPERATURE;
  delete process.env.CHATBOT_PROVIDER;
});

function baseOpts(overrides: Partial<LlmCallOptions> = {}): LlmCallOptions {
  return { system: "SYS", messages: [{ role: "user", content: "Chào shop" }], ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("openai adapter: dịch tool + assistant.tool_use + tool_result, parse tool_calls trả về", async () => {
  process.env.CHATBOT_API_KEY = "sk-test";
  process.env.CHATBOT_BASE_URL = "https://example.test/v1/";
  const { calls } = stubFetch({
    model: "moonshot-v1-8k",
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          content: "",
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "search_flights", arguments: '{"from":"HAN","to":"SGN"}' } },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 18 },
  });

  const res = await callOpenAiCompatible(
    baseOpts({
      messages: [
        { role: "user", content: "Vé HAN SGN?" },
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "call_0", name: "search_flights", input: { from: "HAN" } }],
        },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "call_0", content: '{"markupApplied":true}' }] },
      ],
      tools: [
        {
          name: "search_flights",
          description: "Tìm chuyến",
          input_schema: { type: "object", properties: { from: { type: "string" } }, required: ["from"] },
        },
      ],
    }),
  );

  // URL ghép đúng (bỏ "/" cuối của base).
  assert.equal(calls[0].url, "https://example.test/v1/chat/completions");

  const sent = calls[0].body;
  // system đứng đầu.
  assert.deepEqual(sent.messages[0], { role: "system", content: "SYS" });
  // assistant.tool_use → tool_calls với arguments là JSON string.
  const assistantMsg = sent.messages.find((m: any) => m.role === "assistant");
  assert.equal(assistantMsg.tool_calls[0].function.name, "search_flights");
  assert.equal(assistantMsg.tool_calls[0].function.arguments, '{"from":"HAN"}');
  // tool_result → message role "tool".
  const toolMsg = sent.messages.find((m: any) => m.role === "tool");
  assert.equal(toolMsg.tool_call_id, "call_0");
  assert.equal(toolMsg.content, '{"markupApplied":true}');
  // tool def → function.parameters = input_schema.
  assert.equal(sent.tools[0].type, "function");
  assert.deepEqual(sent.tools[0].function.parameters.required, ["from"]);

  // Phản hồi: tool_calls → stopReason "tool_use", input đã parse.
  assert.equal(res.stopReason, "tool_use");
  assert.equal(res.content.length, 1);
  assert.deepEqual(res.content[0], {
    type: "tool_use",
    id: "call_1",
    name: "search_flights",
    input: { from: "HAN", to: "SGN" },
  });
  assert.equal(res.usage.inputTokens, 120);
  assert.equal(res.usage.outputTokens, 18);
});

test("openai adapter: câu trả lời text thường → stopReason không phải tool_use", async () => {
  process.env.CHATBOT_API_KEY = "sk-test";
  const { calls } = stubFetch({
    model: "moonshot-v1-8k",
    choices: [{ finish_reason: "stop", message: { content: "Dạ em chào anh/chị ạ." } }],
    usage: { prompt_tokens: 40, completion_tokens: 9 },
  });

  const res = await callOpenAiCompatible(baseOpts());

  // Không truyền tools → body không có key tools.
  assert.equal("tools" in calls[0].body, false);
  // Temperature mặc định 0.3.
  assert.equal(calls[0].body.temperature, 0.3);
  assert.equal(res.stopReason, "stop");
  assert.deepEqual(res.content, [{ type: "text", text: "Dạ em chào anh/chị ạ." }]);
});

test("openai adapter: CHATBOT_TEMPERATURE ghi đè được (cho k2.5/k2.6 cần temp=1)", async () => {
  process.env.CHATBOT_API_KEY = "sk-test";
  process.env.CHATBOT_TEMPERATURE = "1";
  const { calls } = stubFetch({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] });

  await callOpenAiCompatible(baseOpts());
  assert.equal(calls[0].body.temperature, 1);
});

test("openai adapter: provider openai mà thiếu CHATBOT_API_KEY → ném ChatbotNotConfiguredError", async () => {
  process.env.CHATBOT_PROVIDER = "openai"; // ép nhánh openai (không fallback ANTHROPIC_API_KEY)
  await assert.rejects(() => callOpenAiCompatible(baseOpts()), /ChatbotNotConfiguredError|chưa được cấu hình/);
});

test("openai adapter: lỗi API → ném LlmApiError kèm message", async () => {
  process.env.CHATBOT_API_KEY = "sk-test";
  stubFetch({ error: { message: "insufficient balance" } }, 402);
  await assert.rejects(() => callOpenAiCompatible(baseOpts()), /insufficient balance/);
});
