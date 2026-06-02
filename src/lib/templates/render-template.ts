import type { Contact } from "@/lib/types";

/**
 * A single `{{ ... }}` occurrence in a template.
 * Supports dotted paths (`custom.dogName`) and a default filter:
 *   {{ firstName | default: "there" }}
 */
export interface TemplateToken {
  raw: string; // full match, e.g. {{ firstName | default: "there" }}
  path: string; // e.g. firstName or custom.dogName
  fallback?: string;
  start: number;
  end: number;
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export function parseTemplate(template: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(template)) !== null) {
    const inner = m[1];
    const [pathPart, ...filterParts] = inner.split("|");
    const path = pathPart.trim();
    let fallback: string | undefined;
    const filter = filterParts.join("|").trim();
    const defMatch = filter.match(/^default\s*:\s*(.+)$/);
    if (defMatch) {
      fallback = defMatch[1].trim().replace(/^["']|["']$/g, "");
    }
    tokens.push({
      raw: m[0],
      path,
      fallback,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return tokens;
}

/**
 * Variables provided by the system (not by contact data). They are injected at
 * send/export time — e.g. `unsubscribe_url`, which a downstream email platform
 * fills per recipient. They always count as "resolvable".
 */
export const SYSTEM_VARIABLES = ["unsubscribe_url"] as const;

/** Build the variable resolution context for a contact. */
export function contactContext(
  contact: Contact,
  system?: Record<string, string>,
): Record<string, unknown> {
  return {
    email: contact.email,
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    fullName:
      contact.fullName ??
      [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    custom: contact.customFields,
    ...(system ?? {}),
  };
}

function lookup(context: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = context;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  if (cur == null) return undefined;
  if (Array.isArray(cur)) return cur.join(", ");
  const str = String(cur);
  return str.length ? str : undefined;
}

export interface RenderResult {
  output: string;
  unresolved: string[];
  usedFallback: string[];
}

/**
 * Render a template for a contact. Unresolved variables without a fallback are
 * left as a visible `{{ path }}` marker AND reported, so the UI can highlight
 * them rather than silently emitting blanks.
 */
export function renderTemplate(
  template: string,
  contact: Contact,
  system?: Record<string, string>,
): RenderResult {
  const context = contactContext(contact, system);
  const tokens = parseTemplate(template);
  const unresolved: string[] = [];
  const usedFallback: string[] = [];

  // Rebuild output left-to-right using token offsets.
  let output = "";
  let cursor = 0;
  for (const t of tokens) {
    output += template.slice(cursor, t.start);
    const value = lookup(context, t.path);
    if (value !== undefined) {
      output += value;
    } else if (t.fallback !== undefined) {
      output += t.fallback;
      usedFallback.push(t.path);
    } else {
      output += t.raw; // keep marker visible
      unresolved.push(t.path);
    }
    cursor = t.end;
  }
  output += template.slice(cursor);

  return { output, unresolved, usedFallback };
}
