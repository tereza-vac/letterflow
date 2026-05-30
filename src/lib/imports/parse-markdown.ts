import { marked } from "marked";
import type { DetectedFileType } from "@/lib/types";

/**
 * Convert Markdown to plain campaign-context text by stripping formatting.
 * We keep the textual content (headings, list items, paragraphs) which is what
 * the AI prompt cares about, and drop links/images syntax noise.
 */
export function markdownToText(md: string): string {
  const tokens = marked.lexer(md);
  const parts: string[] = [];

  const walk = (toks: unknown[]): void => {
    for (const t of toks as Array<Record<string, unknown>>) {
      switch (t.type) {
        case "heading":
        case "paragraph":
        case "text":
          if (typeof t.text === "string") parts.push(t.text);
          break;
        case "list":
          if (Array.isArray(t.items)) walk(t.items);
          break;
        case "list_item":
          if (typeof t.text === "string") parts.push(`- ${t.text}`);
          break;
        case "blockquote":
          if (Array.isArray(t.tokens)) walk(t.tokens);
          break;
        default:
          if (typeof t.text === "string") parts.push(t.text);
      }
    }
  };

  walk(tokens);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Treat .txt as raw context, normalizing line endings and trimming. */
export function plainTextToContext(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Heuristic: decide if a file is more likely a contact source or campaign
 * context based on its extension and a peek at the content. Tabular files with
 * an email-like column lean "contacts"; prose leans "context".
 */
export function detectFileType(
  extension: "xlsx" | "csv" | "md" | "txt",
  sample: string,
): DetectedFileType {
  if (extension === "md" || extension === "txt") return "context";
  if (extension === "xlsx") return "contacts";

  // CSV: look for an email-ish header or '@' tokens in the first few lines.
  const head = sample.slice(0, 2000).toLowerCase();
  const looksLikeEmailHeader = /(^|[,;\t])\s*(e-?mail|mail)\s*([,;\t]|$)/m.test(
    head,
  );
  const hasAtTokens = (head.match(/@/g) ?? []).length >= 2;
  if (looksLikeEmailHeader || hasAtTokens) return "contacts";
  return "unknown";
}
