import Papa from "papaparse";
import type { ParsedTable, RawRow } from "@/lib/types";

/**
 * Parse CSV text into a normalized {@link ParsedTable}. Header detection and
 * delimiter sniffing are delegated to PapaParse. All cell values are coerced
 * to trimmed strings so downstream logic does not have to guard types.
 */
export function parseCsv(text: string, fileName = "file.csv"): ParsedTable {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);

  const rows: RawRow[] = result.data.map((row) => {
    const out: RawRow = {};
    for (const header of headers) {
      const value = row[header];
      out[header] = value == null ? "" : String(value).trim();
    }
    return out;
  });

  return { fileName, headers, rows };
}
