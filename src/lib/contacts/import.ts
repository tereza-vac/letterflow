import type {
  ColumnMapping,
  Contact,
  ImportIssue,
  ImportResult,
  ParsedTable,
} from "@/lib/types";
import { isValidEmail } from "@/lib/contacts/validate";
import {
  deriveFullName,
  normalizeEmail,
  normalizeValue,
} from "@/lib/contacts/normalize";
import { dedupeContacts } from "@/lib/contacts/dedupe";

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface BuildContactsOptions {
  sourceFileId?: string;
  /** Field that must be present for a contact to be considered complete. */
  requiredFields?: Array<"email" | "firstName" | "lastName">;
}

/**
 * Turn a parsed table + confirmed column mappings into a clean, deduplicated
 * {@link ImportResult}. Invalid and review-needed rows are preserved in their
 * own buckets — nothing is silently discarded.
 */
export function buildContacts(
  table: ParsedTable,
  mappings: ColumnMapping[],
  options: BuildContactsOptions = {},
): ImportResult {
  const { sourceFileId, requiredFields = ["email"] } = options;
  const now = new Date().toISOString();

  const valid: Contact[] = [];
  const invalid: Contact[] = [];
  const issues: ImportIssue[] = [];
  const customFieldsDetected = new Set<string>();

  let invalidEmails = 0;
  let missingEmails = 0;
  let missingRequiredFields = 0;

  table.rows.forEach((row, rowIndex) => {
    let email = "";
    let firstName: string | undefined;
    let lastName: string | undefined;
    let fullNameRaw: string | undefined;
    const customFields: Contact["customFields"] = {};

    for (const m of mappings) {
      const raw = row[m.header] ?? "";
      switch (m.field) {
        case "email":
          email = raw;
          break;
        case "firstName":
          firstName = normalizeValue(raw) || undefined;
          break;
        case "lastName":
          lastName = normalizeValue(raw) || undefined;
          break;
        case "fullName":
          fullNameRaw = normalizeValue(raw) || undefined;
          break;
        case "company":
        case "phone":
        case "city":
        case "note": {
          const v = normalizeValue(raw);
          if (v) {
            customFields[m.field] = v;
            customFieldsDetected.add(m.field);
          }
          break;
        }
        case "custom": {
          const key = m.customKey || "custom";
          const v = normalizeValue(raw);
          if (v) {
            customFields[key] = v;
            customFieldsDetected.add(key);
          }
          break;
        }
        case "ignore":
        default:
          break;
      }
    }

    const normalizedEmail = normalizeEmail(email);
    const fullName = deriveFullName(firstName, lastName, fullNameRaw);

    const base: Contact = {
      id: newId("c"),
      email: email.trim(),
      normalizedEmail,
      firstName,
      lastName,
      fullName,
      status: "active",
      customFields,
      sourceFileId,
      createdAt: now,
      updatedAt: now,
    };

    if (!normalizedEmail) {
      missingEmails++;
      issues.push({
        kind: "missing_email",
        message: `Row ${rowIndex + 1} has no email address`,
        contactIndex: invalid.length,
      });
      invalid.push({ ...base, status: "invalid" });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      invalidEmails++;
      issues.push({
        kind: "invalid_email",
        message: `Row ${rowIndex + 1}: "${email}" is not a valid email`,
        contactIndex: invalid.length,
      });
      invalid.push({ ...base, status: "invalid" });
      return;
    }

    // Required-field completeness (non-blocking, but reported).
    for (const rf of requiredFields) {
      if (rf === "email") continue; // already validated above
      if (!base[rf]) {
        missingRequiredFields++;
        issues.push({
          kind: "missing_required_field",
          message: `Row ${rowIndex + 1}: missing ${rf}`,
        });
        break;
      }
    }

    valid.push(base);
  });

  const { merged, exactDuplicatesRemoved, nearDuplicates } =
    dedupeContacts(valid);

  issues.push(...nearDuplicates);

  return {
    contacts: merged,
    invalid,
    needsReview: nearDuplicates,
    issues,
    summary: {
      totalRows: table.rows.length,
      validContacts: merged.length,
      invalidEmails,
      missingEmails,
      exactDuplicatesRemoved,
      nearDuplicatesForReview: nearDuplicates.length,
      missingRequiredFields,
      customFieldsDetected: [...customFieldsDetected],
    },
  };
}
