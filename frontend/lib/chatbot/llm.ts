// Cổng gọi model AI — thiết kế để "chờ" và linh hoạt.
//
// - Chọn provider bằng CHATBOT_PROVIDER: "anthropic" (mặc định) hoặc "openai"
//   (OpenAI-compatible: KIMI/Moonshot, OpenAI, DeepSeek...). Chọn model bằng CHATBOT_MODEL.
// - Chưa có key (CHATBOT_API_KEY / ANTHROPIC_API_KEY) hoặc CHATBOT_ENABLED != "true" →
//   isChatbotConfigured() = false, tầng gọi trả "đang bảo trì" thay vì lỗi. Build vẫn xanh.
// - Dùng fetch thẳng, KHÔNG thêm dependency SDK — engine chỉ tiêu thụ định dạng nội bộ
//   (LlmResponse) nên đổi provider KHÔNG đụng engine/tools.
//
// Tham chiếu: Anthropic POST /v1/messages; OpenAI-compatible POST /v1/chat/completions.

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_OPENAI_MODEL = "moonshot-v1-8k";
const DEFAULT_MAX_TOKENS = 1024;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_OPENAI_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_OPENAI_TEMPERATURE = 0.3;

export type ChatbotProvider = "anthropic" | "openai";

/** Nhà cung cấp model theo CHATBOT_PROVIDER ("anthropic" mặc định). */
export function chatbotProvider(): ChatbotProvider {
  return (process.env.CHATBOT_PROVIDER || "anthropic").trim().toLowerCase() === "openai"
    ? "openai"
    : "anthropic";
}

export function chatbotModel(): string {
  const explicit = (process.env.CHATBOT_MODEL || "").trim();
  if (explicit) return explicit;
  return chatbotProvider() === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_MODEL;
}

/** Key gọi model. Provider "openai" cần CHATBOT_API_KEY; "anthropic" chấp nhận cả ANTHROPIC_API_KEY (tương thích cũ). */
function chatbotApiKey(): string {
  if (chatbotProvider() === "openai") return (process.env.CHATBOT_API_KEY || "").trim();
  return (process.env.CHATBOT_API_KEY || process.env.ANTHROPIC_API_KEY || "").trim();
}

/** Base URL cho provider "openai" (bỏ "/" cuối). Mặc định Moonshot quốc tế. */
function chatbotBaseUrl(): string {
  return (process.env.CHATBOT_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

/** Nhiệt độ cho provider "openai". moonshot-v1-* nên ~0.3; k2.5/k2.6 bắt buộc =1 → đặt CHATBOT_TEMPERATURE=1. */
function chatbotTemperature(): number {
  const t = Number(process.env.CHATBOT_TEMPERATURE);
  return Number.isFinite(t) ? t : DEFAULT_OPENAI_TEMPERATURE;
}

/** Bot đã bật (CHATBOT_ENABLED="true") và có API key chưa. */
export function isChatbotConfigured(): boolean {
  return process.env.CHATBOT_ENABLED === "true" && !!chatbotApiKey();
}

// ─── Kiểu dữ liệu tối thiểu của Messages API ─────────────────────────────────

export type LlmRole = "user" | "assistant";

export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Khối nội dung trong 1 lượt (text của bot, tool_use, hoặc tool_result phía user). */
export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface LlmMessage {
  role: LlmRole;
  content: string | LlmContentBlock[];
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResponse {
  stopReason: string | null;
  content: LlmContentBlock[];
  usage: LlmUsage;
  model: string;
}

export interface LlmCallOptions {
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolDef[];
  maxTokens?: number;
  /** Ghi đè model cho lượt gọi này (mặc định lấy CHATBOT_MODEL). */
  model?: string;
  signal?: AbortSignal;
}

export class ChatbotNotConfiguredError extends Error {
  constructor() {
    super("Chatbot chưa được cấu hình (thiếu ANTHROPIC_API_KEY hoặc CHATBOT_ENABLED).");
    this.name = "ChatbotNotConfiguredError";
  }
}

export class LlmApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LlmApiError";
    this.status = status;
  }
}

/**
 * Gọi một lượt Messages API. Trả về content blocks + stop_reason + usage.
 * Tool-use loop (đọc tool_use → chạy tool → gửi tool_result) do tầng engine điều phối.
 */
export async function callClaude(opts: LlmCallOptions): Promise<LlmResponse> {
  const apiKey = chatbotApiKey();
  if (!apiKey) throw new ChatbotNotConfiguredError();

  const model = (opts.model || chatbotModel()).trim();
  // System prompt để cache_control để tái sử dụng phần cố định qua nhiều lượt (giảm chi phí).
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: opts.messages,
  };
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic API error ${res.status}`;
    throw new LlmApiError(msg, res.status);
  }

  const content: LlmContentBlock[] = Array.isArray(data?.content)
    ? data.content
        .map((block: Record<string, unknown>): LlmContentBlock | null => {
          if (block?.type === "text") return { type: "text", text: String(block.text ?? "") };
          if (block?.type === "tool_use") {
            return {
              type: "tool_use",
              id: String(block.id ?? ""),
              name: String(block.name ?? ""),
              input: (block.input as Record<string, unknown>) ?? {},
            };
          }
          return null; // bỏ qua thinking/khác — chatbot không dùng
        })
        .filter((b: LlmContentBlock | null): b is LlmContentBlock => b !== null)
    : [];

  const usage: LlmUsage = {
    inputTokens: Number(data?.usage?.input_tokens ?? 0),
    outputTokens: Number(data?.usage?.output_tokens ?? 0),
    cacheReadTokens: Number(data?.usage?.cache_read_input_tokens ?? 0),
    cacheWriteTokens: Number(data?.usage?.cache_creation_input_tokens ?? 0),
  };

  return {
    stopReason: (data?.stop_reason as string | null) ?? null,
    content,
    usage,
    model: String(data?.model || model),
  };
}

// ─── Provider OpenAI-compatible (KIMI/Moonshot, OpenAI, DeepSeek...) ──────────
// Dịch định dạng nội bộ (khối kiểu Anthropic) ⇄ Chat Completions của OpenAI. Engine
// không biết provider nào: nó chỉ nhận LlmResponse với content blocks + stopReason.

interface OpenAiToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** LlmToolDef (input_schema) → OpenAI tool (function.parameters). */
function toOpenAiTools(tools?: LlmToolDef[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

/** LlmMessage[] nội bộ → mảng message OpenAI (system + user + assistant.tool_calls + role "tool"). */
function toOpenAiMessages(system: string, messages: LlmMessage[]): unknown[] {
  const out: unknown[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const texts: string[] = [];
      const toolCalls: unknown[] = [];
      for (const b of m.content) {
        if (b.type === "text") texts.push(b.text);
        else if (b.type === "tool_use") {
          toolCalls.push({
            id: b.id,
            type: "function",
            function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
          });
        }
      }
      const msg: Record<string, unknown> = { role: "assistant", content: texts.join("\n") };
      if (toolCalls.length > 0) msg.tool_calls = toolCalls;
      out.push(msg);
    } else {
      // role "user" dạng block: tool_result → message role "tool"; text → message user.
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
        else if (b.type === "text") out.push({ role: "user", content: b.text });
      }
    }
  }
  return out;
}

function safeJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Gọi một lượt Chat Completions (OpenAI-compatible). Chuyển finish_reason "tool_calls"
 * → stopReason "tool_use" để engine hiểu (dùng chung vòng lặp với Anthropic).
 */
export async function callOpenAiCompatible(opts: LlmCallOptions): Promise<LlmResponse> {
  const apiKey = chatbotApiKey();
  if (!apiKey) throw new ChatbotNotConfiguredError();

  const model = (opts.model || chatbotModel()).trim();
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: chatbotTemperature(),
    messages: toOpenAiMessages(opts.system, opts.messages),
  };
  const tools = toOpenAiTools(opts.tools);
  if (tools) body.tools = tools;

  const res = await fetch(`${chatbotBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = data?.error?.message ?? data?.error;
    throw new LlmApiError(typeof err === "string" ? err : `LLM API error ${res.status}`, res.status);
  }

  const choice = data?.choices?.[0];
  const message = choice?.message ?? {};
  const content: LlmContentBlock[] = [];
  if (message.content) content.push({ type: "text", text: String(message.content) });

  const rawToolCalls: OpenAiToolCall[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const tc of rawToolCalls) {
    content.push({
      type: "tool_use",
      id: String(tc.id ?? ""),
      name: String(tc.function?.name ?? ""),
      input: safeJsonObject(tc.function?.arguments),
    });
  }

  // Có tool_calls → engine phải vào nhánh tool ("tool_use"); còn lại giữ finish_reason.
  const stopReason = rawToolCalls.length > 0 ? "tool_use" : (choice?.finish_reason ?? null);

  const u = data?.usage ?? {};
  const usage: LlmUsage = {
    inputTokens: Number(u.prompt_tokens ?? 0),
    outputTokens: Number(u.completion_tokens ?? 0),
    cacheReadTokens: Number(u.cached_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0),
    cacheWriteTokens: 0,
  };

  return { stopReason, content, usage, model: String(data?.model || model) };
}

/** Dispatcher: chọn provider theo env. Engine gọi hàm này (không gọi thẳng callClaude). */
export async function callLlm(opts: LlmCallOptions): Promise<LlmResponse> {
  return chatbotProvider() === "openai" ? callOpenAiCompatible(opts) : callClaude(opts);
}
