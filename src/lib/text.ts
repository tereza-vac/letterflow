/** Low-level string helpers shared across import, dedupe and quality logic. */

/** Remove diacritics (accents) for matching only — never for stored values. */
export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Remove zero-width and other invisible/control characters. */
export function removeInvisibleChars(input: string): string {
  // Zero-width space/joiner, BOM, soft hyphen, and C0/C1 control chars.
  return input
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

/** Collapse internal whitespace runs to a single space and trim. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Build a comparison key: invisible chars removed, diacritics folded,
 * lowercased, whitespace collapsed. Used for fuzzy/exact match keys only.
 */
export function comparisonKey(input: string): string {
  return collapseWhitespace(
    stripDiacritics(removeInvisibleChars(input)).toLowerCase(),
  );
}

/** Normalize a header for synonym matching: lowercase, strip accents/separators. */
export function normalizeHeaderKey(header: string): string {
  return stripDiacritics(removeInvisibleChars(header))
    .toLowerCase()
    .replace(/[\s_\-.]+/g, "");
}

const DIACRITIC_RE = /[\u00C0-\u024F\u1E00-\u1EFF]/;
export function hasDiacritics(input: string): boolean {
  return DIACRITIC_RE.test(input);
}

// Special characters that are unusual inside names/values (excludes typical
// punctuation that appears in real data like apostrophes, hyphens, dots).
const SPECIAL_RE = /[<>{}\[\]\\|`~^=*$%#@!?;:+]/;
export function hasSpecialChars(input: string): boolean {
  return SPECIAL_RE.test(input);
}
