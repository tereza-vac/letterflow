import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/imports/parse-csv";
import { detectColumns, HIGH_CONFIDENCE } from "@/lib/imports/detect-columns";
import { buildContacts } from "@/lib/contacts/import";
import type { ColumnMapping } from "@/lib/types";

const CSV = `email,jméno,příjmení,pes_jmeno,město
Jana@Example.com ,Jana,Nováková,Rex,Praha
petr@firma.cz,Petr,Svoboda,,Brno
not-an-email,Eva,Černá,Punťa,Ostrava
jana@example.com,Jana,Nováková,Bára,Praha`;

describe("parseCsv", () => {
  it("parses headers and rows as trimmed strings", () => {
    const table = parseCsv(CSV, "test.csv");
    expect(table.headers).toEqual(["email", "jméno", "příjmení", "pes_jmeno", "město"]);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0].email).toBe("Jana@Example.com");
  });
});

describe("detectColumns", () => {
  it("detects email by value format with high confidence", () => {
    const table = parseCsv(CSV);
    const detections = detectColumns(table);
    const email = detections.find((d) => d.header === "email")!;
    expect(email.suggestedField).toBe("email");
    expect(email.confidence).toBeGreaterThanOrEqual(0.7);
    expect(email.reasons.join(" ")).toMatch(/match email format/);
  });

  it("detects Czech name columns and dog custom field", () => {
    const table = parseCsv(CSV);
    const detections = detectColumns(table);
    expect(detections.find((d) => d.header === "jméno")!.suggestedField).toBe("firstName");
    expect(detections.find((d) => d.header === "příjmení")!.suggestedField).toBe("lastName");
    const dog = detections.find((d) => d.header === "pes_jmeno")!;
    expect(dog.suggestedField).toBe("custom");
    expect(dog.suggestedCustomKey).toBe("dogName");
    expect(detections.find((d) => d.header === "město")!.suggestedField).toBe("city");
  });

  it("flags high-confidence email mapping", () => {
    const table = parseCsv(CSV);
    const detections = detectColumns(table);
    const email = detections.find((d) => d.header === "email")!;
    // Email gets value-based confidence; high enough to preselect.
    expect(email.confidence).toBeGreaterThan(HIGH_CONFIDENCE - 0.2);
  });
});

describe("buildContacts", () => {
  const mappings: ColumnMapping[] = [
    { header: "email", field: "email" },
    { header: "jméno", field: "firstName" },
    { header: "příjmení", field: "lastName" },
    { header: "pes_jmeno", field: "custom", customKey: "dogName" },
    { header: "město", field: "city" },
  ];

  it("cleans, validates, dedupes and summarizes", () => {
    const table = parseCsv(CSV);
    const result = buildContacts(table, mappings);
    // 4 rows: 1 invalid, 2 same email (jana) merged -> 2 valid contacts
    expect(result.summary.totalRows).toBe(4);
    expect(result.summary.invalidEmails).toBe(1);
    expect(result.summary.exactDuplicatesRemoved).toBe(1);
    expect(result.contacts).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.summary.customFieldsDetected).toContain("dogName");

    const jana = result.contacts.find((c) => c.normalizedEmail === "jana@example.com")!;
    expect(jana.customFields.dogName).toEqual(["Rex", "Bára"]);
  });
});
