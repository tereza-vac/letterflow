import type { Contact } from "@/lib/types";
import { parseTemplate, contactContext } from "@/lib/templates/render-template";

export const KNOWN_TOP_LEVEL = ["email", "firstName", "lastName", "fullName"];

export interface TemplateVariableInfo {
  path: string;
  known: boolean;
  hasFallback: boolean;
  /** Count of contacts for which this variable resolves to a non-empty value. */
  resolvedCount: number;
  missingCount: number;
}

export interface TemplateValidation {
  variables: TemplateVariableInfo[];
  /** Variables that are neither a known top-level field nor a custom.* path. */
  unknownVariables: string[];
}

function resolvesFor(contact: Contact, path: string): boolean {
  const ctx = contactContext(contact);
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return false;
    }
  }
  if (cur == null) return false;
  if (Array.isArray(cur)) return cur.length > 0;
  return String(cur).length > 0;
}

/**
 * Analyze a template against the contact set: list every variable, whether it
 * is a recognized path, and how many contacts are missing a value for it.
 * Powers the "Variable `firstName` is missing for 18 contacts" UI.
 */
export function validateTemplate(
  templates: string[],
  contacts: Contact[],
): TemplateValidation {
  const tokens = templates.flatMap((t) => parseTemplate(t));
  const seen = new Map<string, { fallback: boolean }>();
  for (const t of tokens) {
    const prev = seen.get(t.path);
    seen.set(t.path, { fallback: (prev?.fallback ?? false) || t.fallback !== undefined });
  }

  const variables: TemplateVariableInfo[] = [];
  const unknownVariables: string[] = [];

  for (const [path, { fallback }] of seen) {
    const known =
      KNOWN_TOP_LEVEL.includes(path) || path.startsWith("custom.");
    if (!known) unknownVariables.push(path);

    let resolved = 0;
    for (const c of contacts) if (resolvesFor(c, path)) resolved++;

    variables.push({
      path,
      known,
      hasFallback: fallback,
      resolvedCount: resolved,
      missingCount: contacts.length - resolved,
    });
  }

  return { variables, unknownVariables };
}
