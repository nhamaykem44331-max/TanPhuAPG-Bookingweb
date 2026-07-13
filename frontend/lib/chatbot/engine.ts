// Engine chatbot — điều phối vòng lặp gọi công cụ (tool-use loop).
//
// Một lượt: ghép lịch sử + tin mới → gọi model. Nếu model đòi dùng công cụ thì chạy
// công cụ, đưa kết quả lại cho model, lặp tới khi model trả lời text. Lọc đầu ra
// (chặn tên nhà cung cấp) trước khi trả về.
//
// llm + executeTool được tiêm qua deps để test loop mà không cần API key / DB thật.

import type { ChatChannel } from "@prisma/client";
import {
  callLlm,
  type LlmCallOptions,
  type LlmContentBlock,
  type LlmMessage,
  type LlmResponse,
  type LlmUsage,
} from "./llm";
import { CHAT_TOOLS, executeTool as realExecuteTool, type ToolContext } from "./tools";
import { SYSTEM_PROMPT, buildDateContext } from "./systemPrompt";
import { filterBotOutput } from "./guardrail";

const MAX_TOOL_ITERATIONS = 4;
const MAX_TOKENS = 1024;

const FALLBACK_REPLY = "Dạ em chưa rõ ý anh/chị lắm, anh/chị nói rõ hơn giúp em nhé ạ.";
const ESCALATE_REPLY = "Dạ để chắc chắn nhất, em xin phép chuyển nhân viên hỗ trợ anh/chị kỹ hơn nhé ạ.";

export interface ChatTurnInput {
  conversationId?: string;
  channel: ChatChannel;
  /** Ngày hôm nay YYYY-MM-DD theo giờ Việt Nam. */
  today: string;
  /** Lịch sử các lượt text trước đó (không gồm system prompt). */
  history: LlmMessage[];
  userText: string;
}

export interface ChatTurnResult {
  reply: string;
  usage: LlmUsage;
  toolsUsed: string[];
  /** true nếu đầu ra model có lọt tên nhà cung cấp (đã che) — tầng gọi nên cảnh báo nội bộ. */
  leaked: boolean;
}

export interface ChatEngineDeps {
  llm: (opts: LlmCallOptions) => Promise<LlmResponse>;
  executeTool: (name: string, input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const defaultDeps: ChatEngineDeps = { llm: callLlm, executeTool: realExecuteTool };

function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export async function runChatTurn(
  input: ChatTurnInput,
  deps: ChatEngineDeps = defaultDeps,
): Promise<ChatTurnResult> {
  const toolCtx: ToolContext = { conversationId: input.conversationId, channel: input.channel };
  const messages: LlmMessage[] = [
    ...input.history,
    { role: "user", content: `${buildDateContext(input.today)}\n\n${input.userText}` },
  ];

  let usage: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const toolsUsed: string[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await deps.llm({ system: SYSTEM_PROMPT, messages, tools: CHAT_TOOLS, maxTokens: MAX_TOKENS });
    usage = addUsage(usage, res.usage);
    messages.push({ role: "assistant", content: res.content });

    if (res.stopReason === "tool_use") {
      const toolUses = res.content.filter(
        (b): b is Extract<LlmContentBlock, { type: "tool_use" }> => b.type === "tool_use",
      );
      const toolResults: LlmContentBlock[] = [];
      for (const tu of toolUses) {
        toolsUsed.push(tu.name);
        const out = await deps.executeTool(tu.name, tu.input, toolCtx);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Model đã trả lời text → lọc đầu ra rồi trả về.
    const rawText = res.content
      .filter((b): b is Extract<LlmContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const { text, leaked } = filterBotOutput(rawText);
    return { reply: text || FALLBACK_REPLY, usage, toolsUsed, leaked };
  }

  // Quá số vòng gọi công cụ → chuyển nhân viên cho an toàn.
  return { reply: ESCALATE_REPLY, usage, toolsUsed, leaked: false };
}
