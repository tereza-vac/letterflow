import type { UploadedFile } from "@/lib/types";
import { parseCsv } from "@/lib/imports/parse-csv";
import { parseXlsx } from "@/lib/imports/parse-xlsx";
import {
  markdownToText,
  plainTextToContext,
  detectFileType,
} from "@/lib/imports/parse-markdown";

const EXT_RE = /\.(xlsx|csv|md|txt)$/i;

export function isSupported(name: string): boolean {
  return EXT_RE.test(name);
}

let fileCounter = 0;

/** Read and parse a browser File into an {@link UploadedFile}. */
export async function processFile(file: File): Promise<UploadedFile> {
  const match = file.name.match(EXT_RE);
  const extension = (match?.[1].toLowerCase() ?? "txt") as UploadedFile["extension"];
  fileCounter += 1;
  const id = `file_${Date.now().toString(36)}_${fileCounter.toString(36)}`;
  const now = new Date().toISOString();

  const base: UploadedFile = {
    id,
    name: file.name,
    extension,
    detectedType: "unknown",
    size: file.size,
    createdAt: now,
  };

  if (extension === "xlsx") {
    const buf = await file.arrayBuffer();
    const table = parseXlsx(buf, file.name);
    return { ...base, table, detectedType: "contacts" };
  }

  const text = await file.text();

  if (extension === "csv") {
    const table = parseCsv(text, file.name);
    const detectedType = detectFileType("csv", text);
    return { ...base, table, detectedType };
  }

  if (extension === "md") {
    return { ...base, contextText: markdownToText(text), detectedType: "context" };
  }

  // txt
  return { ...base, contextText: plainTextToContext(text), detectedType: "context" };
}
