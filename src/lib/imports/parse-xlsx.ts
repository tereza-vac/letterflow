import * as XLSX from "xlsx";
import type { ParsedTable, RawRow } from "@/lib/types";

/**
 * Parse the first non-empty worksheet of an XLSX file (provided as bytes) into
 * a {@link ParsedTable}. The first row is treated as the header row. Empty
 * trailing rows are dropped.
 */
export function parseXlsx(
  data: ArrayBuffer | Uint8Array,
  fileName = "file.xlsx",
): ParsedTable {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { fileName, headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  // `header: 1` returns an array-of-arrays so we control header handling.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (matrix.length === 0) return { fileName, headers: [], rows: [] };

  const headers = (matrix[0] as unknown[])
    .map((h) => String(h ?? "").trim())
    .filter(Boolean);

  const rows: RawRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const rowArr = matrix[i] as unknown[];
    const row: RawRow = {};
    let hasValue = false;
    headers.forEach((header, col) => {
      const value = rowArr[col];
      const str = value == null ? "" : String(value).trim();
      if (str) hasValue = true;
      row[header] = str;
    });
    if (hasValue) rows.push(row);
  }

  return { fileName, headers, rows };
}
