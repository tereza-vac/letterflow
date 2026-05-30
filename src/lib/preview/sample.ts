import type { Contact } from "@/lib/types";
import { hasDiacritics } from "@/lib/text";

export interface PreviewSample {
  label: string;
  reason: string;
  contact: Contact;
}

function customFieldCount(c: Contact): number {
  return Object.keys(c.customFields).length;
}

function maxValueLength(c: Contact): number {
  const values: string[] = [c.email, c.firstName ?? "", c.lastName ?? "", c.fullName ?? ""];
  for (const v of Object.values(c.customFields)) {
    if (Array.isArray(v)) values.push(...v);
    else values.push(v);
  }
  return values.reduce((max, v) => Math.max(max, v.length), 0);
}

function hasMultiValueCustom(c: Contact): boolean {
  return Object.values(c.customFields).some((v) => Array.isArray(v) && v.length > 1);
}

function anyDiacritics(c: Contact): boolean {
  if (hasDiacritics(`${c.firstName ?? ""}${c.lastName ?? ""}${c.fullName ?? ""}`))
    return true;
  return Object.values(c.customFields).some((v) =>
    (Array.isArray(v) ? v.join(" ") : v) && hasDiacritics(Array.isArray(v) ? v.join(" ") : v),
  );
}

/**
 * Pick a diverse, deterministic-ish set of contacts for previewing so the user
 * never reviews only the first row. Avoids returning duplicates.
 */
export function buildPreviewSamples(contacts: Contact[]): PreviewSample[] {
  if (contacts.length === 0) return [];
  const used = new Set<string>();
  const samples: PreviewSample[] = [];

  const pick = (label: string, reason: string, contact: Contact | undefined) => {
    if (!contact || used.has(contact.id)) return;
    used.add(contact.id);
    samples.push({ label, reason, contact });
  };

  pick("First contact", "The first row in the list", contacts[0]);

  // Pseudo-random but stable: pick the middle element.
  pick("Random contact", "A contact from the middle of the list", contacts[Math.floor(contacts.length / 2)]);

  pick(
    "Missing first name",
    "Tests how the email reads without a first name",
    contacts.find((c) => !c.firstName),
  );

  pick(
    "Many custom fields",
    "Has the most custom fields filled in",
    [...contacts].sort((a, b) => customFieldCount(b) - customFieldCount(a))[0],
  );

  pick(
    "Long values",
    "Contains unusually long values",
    [...contacts].sort((a, b) => maxValueLength(b) - maxValueLength(a))[0],
  );

  pick(
    "Diacritics / special characters",
    "Includes accented or non-ASCII characters",
    contacts.find((c) => anyDiacritics(c)),
  );

  pick(
    "Multiple values in a field",
    "A custom field holds several merged values",
    contacts.find((c) => hasMultiValueCustom(c)),
  );

  return samples;
}
