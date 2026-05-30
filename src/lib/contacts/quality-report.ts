import type { Contact, FieldQuality, QualityReport } from "@/lib/types";
import { isValidEmail } from "@/lib/contacts/validate";
import { hasDiacritics, hasSpecialChars } from "@/lib/text";

const LONG_VALUE_THRESHOLD = 80;

function valueToStrings(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Compute transparent data-quality metrics across a contact set: per-field
 * missing rates, long values, diacritics/special characters, plus invalid
 * email and duplicate rates. Pure and side-effect free for easy testing.
 */
export function buildQualityReport(
  contacts: Contact[],
  invalidCount = 0,
  exactDuplicatesRemoved = 0,
): QualityReport {
  const total = contacts.length;

  // Collect the union of all fields (core + custom) present in the data.
  const coreFields: Array<keyof Contact> = ["email", "firstName", "lastName", "fullName"];
  const customKeys = new Set<string>();
  for (const c of contacts) {
    for (const k of Object.keys(c.customFields)) customKeys.add(k);
  }

  const fields: FieldQuality[] = [];

  const analyze = (
    field: string,
    getter: (c: Contact) => string[],
  ): FieldQuality => {
    let missing = 0;
    let longValues = 0;
    let withDiacritics = 0;
    let withSpecialChars = 0;
    const lengthSamples: number[] = [];

    for (const c of contacts) {
      const values = getter(c).filter((v) => v && v.trim().length > 0);
      if (values.length === 0) {
        missing++;
        continue;
      }
      for (const v of values) {
        lengthSamples.push(v.length);
        if (v.length > LONG_VALUE_THRESHOLD) longValues++;
        if (hasDiacritics(v)) withDiacritics++;
        if (hasSpecialChars(v)) withSpecialChars++;
      }
    }

    // Inconsistent format heuristic: wide spread in value lengths.
    let inconsistentFormat = false;
    if (lengthSamples.length > 3) {
      const min = Math.min(...lengthSamples);
      const max = Math.max(...lengthSamples);
      inconsistentFormat = max - min > 30;
    }

    return {
      field,
      total,
      missing,
      missingRate: total ? missing / total : 0,
      longValues,
      withDiacritics,
      withSpecialChars,
      inconsistentFormat,
    };
  };

  for (const f of coreFields) {
    fields.push(
      analyze(String(f), (c) => valueToStrings(c[f] as string | undefined)),
    );
  }
  for (const key of customKeys) {
    fields.push(analyze(`custom.${key}`, (c) => valueToStrings(c.customFields[key])));
  }

  const invalidEmailRate =
    total + invalidCount > 0 ? invalidCount / (total + invalidCount) : 0;
  const duplicateRate =
    total + exactDuplicatesRemoved > 0
      ? exactDuplicatesRemoved / (total + exactDuplicatesRemoved)
      : 0;

  let suspiciousRows = 0;
  for (const c of contacts) {
    const emailBad = !isValidEmail(c.normalizedEmail);
    const longName = (c.fullName?.length ?? 0) > LONG_VALUE_THRESHOLD;
    if (emailBad || longName) suspiciousRows++;
  }

  return {
    totalContacts: total,
    invalidEmailRate,
    duplicateRate,
    suspiciousRows,
    fields,
  };
}
