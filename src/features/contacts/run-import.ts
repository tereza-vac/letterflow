import type {
  ColumnMapping,
  Contact,
  ImportIssue,
  ImportResult,
  UploadedFile,
} from "@/lib/types";
import { buildContacts } from "@/lib/contacts/import";
import { dedupeContacts } from "@/lib/contacts/dedupe";

/**
 * Run the import across every contact file and merge the results, then perform
 * a final cross-file deduplication by normalized email.
 */
export function runImport(
  files: UploadedFile[],
  mappingsByFile: Record<string, ColumnMapping[]>,
): ImportResult {
  const allValid: Contact[] = [];
  const allInvalid: Contact[] = [];
  const issues: ImportIssue[] = [];
  const customFields = new Set<string>();

  let totalRows = 0;
  let invalidEmails = 0;
  let missingEmails = 0;
  let perFileDuplicates = 0;
  let missingRequiredFields = 0;

  for (const file of files) {
    if (!file.table) continue;
    const mappings = mappingsByFile[file.id] ?? [];
    if (!mappings.some((m) => m.field === "email")) continue;

    const res = buildContacts(file.table, mappings, { sourceFileId: file.id });
    allValid.push(...res.contacts);
    allInvalid.push(...res.invalid);
    issues.push(...res.issues);
    totalRows += res.summary.totalRows;
    invalidEmails += res.summary.invalidEmails;
    missingEmails += res.summary.missingEmails;
    perFileDuplicates += res.summary.exactDuplicatesRemoved;
    missingRequiredFields += res.summary.missingRequiredFields;
    res.summary.customFieldsDetected.forEach((c) => customFields.add(c));
  }

  const { merged, exactDuplicatesRemoved, nearDuplicates } = dedupeContacts(allValid);

  return {
    contacts: merged,
    invalid: allInvalid,
    needsReview: nearDuplicates,
    issues: [...issues.filter((i) => i.kind !== "near_duplicate"), ...nearDuplicates],
    summary: {
      totalRows,
      validContacts: merged.length,
      invalidEmails,
      missingEmails,
      exactDuplicatesRemoved: perFileDuplicates + exactDuplicatesRemoved,
      nearDuplicatesForReview: nearDuplicates.length,
      missingRequiredFields,
      customFieldsDetected: [...customFields],
    },
  };
}
