import type { Contact, UploadedFile } from "@/lib/types";
import { effectiveFileType } from "@/lib/types";

/** Anonymized field names available for personalization (no values). */
export function collectFieldNames(contacts: Contact[]): string[] {
  const names = new Set<string>(["email"]);
  for (const c of contacts) {
    if (c.firstName) names.add("firstName");
    if (c.lastName) names.add("lastName");
    if (c.fullName) names.add("fullName");
    for (const k of Object.keys(c.customFields)) names.add(`custom.${k}`);
  }
  return [...names];
}

/** Concatenated text from all files marked as campaign context. */
export function collectContextText(files: UploadedFile[]): string {
  return files
    .filter((f) => effectiveFileType(f) === "context" && f.contextText)
    .map((f) => `# ${f.name}\n${f.contextText}`)
    .join("\n\n")
    .trim();
}
