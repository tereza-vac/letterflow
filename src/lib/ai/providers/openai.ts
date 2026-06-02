import {
  EmailDraft,
  GeneratedEmail,
  type AiProvider,
  type AiProviderConfig,
  type GenerateOptions,
  type RefineOptions,
  type RewriteOptions,
} from "@/lib/ai/types";
import {
  SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT,
  buildUserPrompt,
  buildRefinePrompt,
  buildRewritePrompt,
} from "@/lib/ai/prompt";
import { aiProviderPost, isGeminiEndpoint } from "@/lib/ai/http";

/** Strip accidental ```json fences so JSON.parse won't choke. */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate.trim();
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

async function chat(
  config: AiProviderConfig,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
  options: { json?: boolean; temperature?: number } = { json: true, temperature: 0.7 },
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const useJsonMode = options.json !== false && !isGeminiEndpoint(config.baseUrl);
  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.7,
    ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  let res: Response;
  try {
    res = await aiProviderPost(url, payload, apiKey);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  let data: ChatResponse;
  try {
    data = (await res.json()) as ChatResponse;
  } catch {
    throw new Error(`AI returned a non-JSON response (${res.status}). Check Settings → Base URL.`);
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `AI request failed (${res.status})`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  return content;
}

/**
 * OpenAI-compatible provider. Works against the OpenAI API and any service that
 * exposes the same `/chat/completions` contract (configurable base URL/model).
 */
export const openAiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI-compatible",

  async generateEmail(options: GenerateOptions): Promise<GeneratedEmail> {
    const { config, apiKey, payload, signal } = options;
    const content = await chat(
      config,
      apiKey,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(payload) },
      ],
      signal,
      { temperature: 0.3 },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      throw new Error("AI returned text that was not valid JSON. Try again.");
    }
    const result = GeneratedEmail.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        "AI response did not match the expected structure. Try again.",
      );
    }
    return result.data;
  },

  async refineEmail(options: RefineOptions): Promise<EmailDraft> {
    const { config, apiKey, signal } = options;
    const content = await chat(
      config,
      apiKey,
      [
        { role: "system", content: REFINE_SYSTEM_PROMPT },
        { role: "user", content: buildRefinePrompt(options) },
      ],
      signal,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      throw new Error("AI returned text that was not valid JSON. Try again.");
    }
    const result = EmailDraft.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response did not match the expected structure. Try again.");
    }
    return result.data;
  },

  async rewriteSelection(options: RewriteOptions): Promise<string> {
    const { config, apiKey, signal } = options;
    const content = await chat(
      config,
      apiKey,
      [
        { role: "system", content: REWRITE_SYSTEM_PROMPT },
        { role: "user", content: buildRewritePrompt(options) },
      ],
      signal,
      { json: false },
    );
    return content.trim();
  },

  async testConnection(config: AiProviderConfig, apiKey: string): Promise<void> {
    await chat(config, apiKey, [
      { role: "system", content: "Reply with the single word: ok" },
      { role: "user", content: "ping" },
    ]);
  },
};
