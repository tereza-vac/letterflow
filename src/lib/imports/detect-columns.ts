import type {
  CanonicalField,
  ColumnDetection,
  ParsedTable,
} from "@/lib/types";
import { normalizeHeaderKey, comparisonKey } from "@/lib/text";
import { emailMatchRatio } from "@/lib/contacts/validate";
import { jaroWinkler } from "@/lib/contacts/fuzzy";

/**
 * Header synonyms (normalized via {@link normalizeHeaderKey}, i.e. lowercased,
 * accents folded, separators stripped). Includes English and Czech variants,
 * plus the domain-specific "dog" custom field from the spec.
 */
interface SynonymGroup {
  field: CanonicalField;
  customKey?: string;
  /** Normalized header keys that map exactly to this field. */
  keys: string[];
  /** Human label used in confidence explanations. */
  label: string;
}

const SYNONYMS: SynonymGroup[] = [
  {
    field: "email",
    label: "email",
    keys: ["email", "emailaddress", "mail", "em-ail", "e-mail", "mailaddress"],
  },
  {
    field: "firstName",
    label: "first_name",
    keys: ["firstname", "jmeno", "krestnijmeno", "fname", "givenname"],
  },
  {
    field: "lastName",
    label: "last_name",
    keys: ["lastname", "surname", "prijmeni", "lname", "familyname"],
  },
  {
    field: "fullName",
    label: "full name",
    keys: ["name", "fullname", "celejmeno", "jmenoaprijmeni", "contact"],
  },
  {
    field: "custom",
    customKey: "dogName",
    label: "dog name",
    keys: ["pes", "pesjmeno", "jmenopsa", "dog", "dogname", "petname", "pet"],
  },
  { field: "company", label: "company", keys: ["company", "firma", "organization", "org"] },
  { field: "phone", label: "phone", keys: ["phone", "telefon", "tel", "mobile", "mobil"] },
  { field: "city", label: "city", keys: ["city", "mesto", "town"] },
  { field: "note", label: "note", keys: ["note", "poznamka", "notes", "comment"] },
];

function columnValues(table: ParsedTable, header: string): string[] {
  return table.rows.map((r) => r[header] ?? "").map((v) => v.trim());
}

function bestHeaderMatch(headerKey: string): {
  group: SynonymGroup;
  similarity: number;
} | null {
  let best: { group: SynonymGroup; similarity: number } | null = null;
  for (const group of SYNONYMS) {
    for (const key of group.keys) {
      const sim = key === headerKey ? 1 : jaroWinkler(headerKey, key);
      if (!best || sim > best.similarity) best = { group, similarity: sim };
    }
  }
  return best;
}

/** Heuristic: do the values look like short personal names? */
function looksLikePersonalNames(values: string[]): boolean {
  const nonEmpty = values.filter(Boolean).slice(0, 50);
  if (nonEmpty.length === 0) return false;
  let nameish = 0;
  for (const v of nonEmpty) {
    const tokens = v.split(/\s+/);
    const onlyLetters = /^[\p{L}'.\- ]+$/u.test(v);
    const shortEnough = tokens.length <= 3 && v.length <= 40;
    if (onlyLetters && shortEnough) nameish++;
  }
  return nameish / nonEmpty.length >= 0.7;
}

/**
 * Detect the most likely canonical field for every column of a parsed table,
 * with a 0..1 confidence and human-readable reasons (per the product spec).
 */
export function detectColumns(table: ParsedTable): ColumnDetection[] {
  return table.headers.map((header) => {
    const headerKey = normalizeHeaderKey(header);
    const values = columnValues(table, header);
    const sampleValues = values.filter(Boolean).slice(0, 4);
    const reasons: string[] = [];

    const match = bestHeaderMatch(headerKey);
    let field: CanonicalField = "custom";
    let customKey: string | undefined;
    let confidence = 0.2;

    if (match && match.similarity >= 0.86) {
      field = match.group.field;
      customKey = match.group.customKey;
      confidence = match.similarity >= 0.999 ? 0.7 : 0.55;
      reasons.push(
        match.similarity >= 0.999
          ? `Column name matches "${match.group.label}"`
          : `Column name is similar to "${match.group.label}" (${Math.round(match.similarity * 100)}%)`,
      );
    }

    // Value-based signals refine / override the header guess.
    const emailRatio = emailMatchRatio(values);
    if (emailRatio >= 0.7) {
      field = "email";
      customKey = undefined;
      confidence = Math.max(confidence, emailRatio);
      reasons.unshift(`${Math.round(emailRatio * 100)}% of values match email format`);
    } else if (field === "email" && emailRatio < 0.5) {
      // Header said email but values disagree — drop confidence and reconsider.
      confidence = Math.min(confidence, 0.4);
      reasons.push(`Only ${Math.round(emailRatio * 100)}% of values match email format`);
    }

    if (
      field !== "email" &&
      (field === "firstName" || field === "lastName" || field === "fullName" || field === "custom") &&
      looksLikePersonalNames(values)
    ) {
      confidence = Math.min(1, confidence + 0.2);
      reasons.push("Values look like short personal names");
      if (field === "custom" && !customKey) {
        // No header hint but name-like values: suggest fullName as a guess.
        field = "fullName";
        reasons.push("Defaulting to full name (no clear header match)");
      }
    }

    if (field === "custom") {
      customKey = customKey ?? slugifyHeader(header);
      if (reasons.length === 0)
        reasons.push("No known field matched; kept as a custom field");
    }

    // Uniqueness signal helps email/identifier columns.
    const distinct = new Set(values.filter(Boolean).map((v) => comparisonKey(v)));
    const nonEmpty = values.filter(Boolean).length;
    if (field === "email" && nonEmpty > 0 && distinct.size / nonEmpty > 0.95) {
      confidence = Math.min(1, confidence + 0.02);
    }

    return {
      header,
      suggestedField: field,
      suggestedCustomKey: field === "custom" ? customKey : undefined,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      sampleValues,
    };
  });
}

/** Turn an arbitrary header into a safe custom field key (camel-ish). */
export function slugifyHeader(header: string): string {
  const cleaned = comparisonKey(header).replace(/[^a-z0-9 ]/g, "");
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "field";
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  );
}

/** Confidence threshold above which a mapping can be preselected. */
export const HIGH_CONFIDENCE = 0.8;
