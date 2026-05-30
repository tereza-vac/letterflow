import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isTauri } from "@/lib/runtime";
import type { Campaign, Contact, ImportResult } from "@/lib/types";

/** Flatten a contact into a single CSV/XLSX row (custom fields prefixed). */
function flattenContact(c: Contact): Record<string, string> {
  const row: Record<string, string> = {
    email: c.email,
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    fullName: c.fullName ?? "",
    status: c.status,
  };
  for (const [k, v] of Object.entries(c.customFields)) {
    row[k] = Array.isArray(v) ? v.join("; ") : v;
  }
  return row;
}

export function contactsToCsv(contacts: Contact[]): string {
  return Papa.unparse(contacts.map(flattenContact));
}

export function contactsToXlsx(contacts: Contact[]): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(contacts.map(flattenContact));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function importReportText(result: ImportResult): string {
  const s = result.summary;
  const lines = [
    "letterflow — Import report",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total rows imported:        ${s.totalRows}`,
    `Valid contacts:             ${s.validContacts}`,
    `Invalid emails:             ${s.invalidEmails}`,
    `Missing emails:             ${s.missingEmails}`,
    `Exact duplicates removed:   ${s.exactDuplicatesRemoved}`,
    `Near-duplicates to review:  ${s.nearDuplicatesForReview}`,
    `Missing required fields:    ${s.missingRequiredFields}`,
    `Custom fields detected:     ${s.customFieldsDetected.join(", ") || "(none)"}`,
    "",
    "Issues:",
    ...result.issues.map((i) => `  - [${i.kind}] ${i.message}`),
  ];
  return lines.join("\n");
}

/** A full campaign archive bundling the draft, contacts and report. */
export function campaignArchiveJson(
  campaign: Campaign,
  contacts: Contact[],
  importResult: ImportResult | null,
): string {
  return JSON.stringify(
    {
      meta: { app: "letterflow", version: "0.1.0", exportedAt: new Date().toISOString() },
      campaign,
      contacts,
      import: importResult
        ? { summary: importResult.summary, issues: importResult.issues }
        : null,
    },
    null,
    2,
  );
}

/**
 * Save bytes/text to disk. In Tauri a native save dialog is shown; in the
 * browser a download is triggered. Returns the path (Tauri) or filename.
 */
export async function saveFile(
  filename: string,
  data: string | Uint8Array,
  mime = "application/octet-stream",
): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile, writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename });
    if (!path) return null;
    if (typeof data === "string") await writeTextFile(path, data);
    else await writeFile(path, data);
    return path;
  }

  // Browser fallback.
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
