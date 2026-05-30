import { collapseWhitespace, removeInvisibleChars } from "@/lib/text";

/**
 * Normalize an email for storage and exact-match deduplication:
 * - strip invisible characters
 * - trim and collapse whitespace
 * - lowercase
 * Note: we do NOT strip dots or "+tags" — those can be semantically meaningful
 * for some providers, and silently changing addresses would be data loss.
 */
export function normalizeEmail(raw: string): string {
  return collapseWhitespace(removeInvisibleChars(raw)).toLowerCase();
}

/** Normalize a display value (name, city, ...) without lowercasing. */
export function normalizeValue(raw: string): string {
  return collapseWhitespace(removeInvisibleChars(raw));
}

/** Derive a full name from parts when one is not explicitly provided. */
export function deriveFullName(
  firstName?: string,
  lastName?: string,
  fullName?: string,
): string | undefined {
  const explicit = fullName ? normalizeValue(fullName) : "";
  if (explicit) return explicit;
  const parts = [firstName, lastName]
    .map((p) => (p ? normalizeValue(p) : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}
