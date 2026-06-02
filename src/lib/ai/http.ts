import { isTauri } from "@/lib/runtime";

/**
 * Fetch used for outbound HTTP calls (web pages, etc.).
 *
 * In the Tauri desktop app the request is routed through the HTTP plugin, which
 * performs it from the Rust side. This bypasses both the webview's
 * Content-Security-Policy and browser CORS.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, {
      ...init,
      connectTimeout: 30_000,
    });
  }
  return fetch(url, init);
}

interface AiHttpResult {
  status: number;
  body: string;
}

/**
 * POST to an AI chat/completions endpoint.
 *
 * Uses a native Rust command in the desktop app with a 120s timeout — the
 * default HTTP client times out around 30s, which is too short for full email
 * generation on slower models.
 */
export async function aiProviderPost(
  url: string,
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<Response> {
  const body = JSON.stringify(payload);

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<AiHttpResult>("ai_http_post", {
      req: { url, body, apiKey: apiKey },
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch (err) {
    throw new Error(
      wrapBrowserFetchError(err),
    );
  }
}

function wrapBrowserFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
    return (
      "Cannot reach the AI API from the browser preview (blocked by CORS). " +
      "Run the desktop app instead: npm run tauri dev"
    );
  }
  return msg;
}

/** True when the configured endpoint is Google's Gemini OpenAI-compatible API. */
export function isGeminiEndpoint(baseUrl: string): boolean {
  return baseUrl.includes("generativelanguage.googleapis.com");
}
