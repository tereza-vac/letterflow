import type { Contact, ImportIssue } from "@/lib/types";
import { nameSimilarity } from "@/lib/contacts/fuzzy";

export interface DedupeResult {
  merged: Contact[];
  exactDuplicatesRemoved: number;
  nearDuplicates: ImportIssue[];
}

/** Merge a custom-field value into an existing value, preserving multiplicity. */
function mergeCustomValue(
  existing: string | string[] | undefined,
  incoming: string | string[] | undefined,
): string | string[] | undefined {
  const toList = (v: string | string[] | undefined): string[] =>
    v == null ? [] : Array.isArray(v) ? v : [v];

  const set = new Set<string>();
  const out: string[] = [];
  for (const v of [...toList(existing), ...toList(incoming)]) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (set.has(key)) continue;
    set.add(key);
    out.push(t);
  }
  if (out.length === 0) return undefined;
  return out.length === 1 ? out[0] : out;
}

function mergeContacts(base: Contact, incoming: Contact): Contact {
  const customFields: Contact["customFields"] = { ...base.customFields };
  for (const [key, value] of Object.entries(incoming.customFields)) {
    const merged = mergeCustomValue(customFields[key], value);
    if (merged !== undefined) customFields[key] = merged;
  }
  return {
    ...base,
    firstName: base.firstName ?? incoming.firstName,
    lastName: base.lastName ?? incoming.lastName,
    fullName: base.fullName ?? incoming.fullName,
    customFields,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deduplicate contacts by normalized email (exact match only). Custom fields
 * from duplicates are merged carefully — multiple distinct values are kept as
 * a list rather than being dropped. Near-duplicate *names* are NEVER merged
 * automatically; they are surfaced as review issues with a similarity score.
 */
export function dedupeContacts(
  contacts: Contact[],
  nearDuplicateThreshold = 0.92,
): DedupeResult {
  const byEmail = new Map<string, number>(); // normalizedEmail -> index in merged
  const merged: Contact[] = [];
  let exactDuplicatesRemoved = 0;

  for (const contact of contacts) {
    const key = contact.normalizedEmail;
    const existingIdx = key ? byEmail.get(key) : undefined;
    if (key && existingIdx !== undefined) {
      merged[existingIdx] = mergeContacts(merged[existingIdx], contact);
      exactDuplicatesRemoved++;
    } else {
      const idx = merged.push(contact) - 1;
      if (key) byEmail.set(key, idx);
    }
  }

  // Flag near-duplicate names across *different* emails for human review only.
  const nearDuplicates: ImportIssue[] = [];
  for (let i = 0; i < merged.length; i++) {
    const a = merged[i];
    const aName = a.fullName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
    if (!aName) continue;
    for (let j = i + 1; j < merged.length; j++) {
      const b = merged[j];
      if (a.normalizedEmail === b.normalizedEmail) continue;
      const bName = b.fullName ?? `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim();
      if (!bName) continue;
      const { score, explanation } = nameSimilarity(aName, bName);
      // Different emails with very similar (or identical) names are worth a
      // human look — but we never merge them automatically.
      if (score >= nearDuplicateThreshold) {
        nearDuplicates.push({
          kind: "near_duplicate",
          message: `"${aName}" (${a.email}) is similar to "${bName}" (${b.email}). ${explanation}. Not merged — review manually.`,
          contactIndex: i,
          relatedIndex: j,
          score,
        });
      }
    }
  }

  return { merged, exactDuplicatesRemoved, nearDuplicates };
}
