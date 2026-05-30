/**
 * Runtime detection helpers. letterflow runs in two environments:
 *  - the Tauri webview (production desktop app), where native APIs exist; and
 *  - a plain browser (Vite dev server / tests), where they don't.
 * Code paths that need native capabilities check {@link isTauri} and fall back
 * to safe browser behaviour otherwise.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 injects these globals into the webview.
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    "isTauri" in window
  );
}

/** Best-effort online check used by the Welcome / connection screen. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
