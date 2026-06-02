import { isTauri } from "@/lib/runtime";

/**
 * Fetch used for outbound AI provider calls.
 *
 * In the Tauri desktop app the request is routed through the HTTP plugin, which
 * performs it from the Rust side. This bypasses both the webview's
 * Content-Security-Policy and browser CORS — so any user-configured provider
 * (OpenAI, Gemini's OpenAI-compatible endpoint, Azure, a local server, …)
 * works without per-host allowlisting.
 *
 * In a plain browser (the Vite dev preview) it falls back to the global fetch,
 * which is still subject to CORS — most hosted AI APIs will reject those
 * cross-origin calls, so real generation should be tested in the desktop app.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, init);
  }
  return fetch(url, init);
}
