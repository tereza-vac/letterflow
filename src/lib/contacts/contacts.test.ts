import { describe, it, expect } from "vitest";
import { isValidEmail, emailMatchRatio } from "@/lib/contacts/validate";
import { normalizeEmail, deriveFullName } from "@/lib/contacts/normalize";
import { levenshtein, jaroWinkler, nameSimilarity } from "@/lib/contacts/fuzzy";
import { dedupeContacts } from "@/lib/contacts/dedupe";
import type { Contact } from "@/lib/types";

function contact(p: Partial<Contact> & { email: string }): Contact {
  const now = new Date().toISOString();
  return {
    id: Math.random().toString(36),
    status: "active",
    customFields: {},
    createdAt: now,
    updatedAt: now,
    ...p,
    email: p.email,
    normalizedEmail: normalizeEmail(p.email),
  };
}

describe("validate", () => {
  it("accepts normal emails", () => {
    expect(isValidEmail("jane.doe@example.com")).toBe(true);
    expect(isValidEmail("a+tag@sub.example.co.uk")).toBe(true);
  });
  it("rejects malformed emails", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a..b@c.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
  it("computes email match ratio", () => {
    expect(emailMatchRatio(["a@b.com", "x", "c@d.com", "c@d.com"])).toBeCloseTo(0.75, 5);
    expect(emailMatchRatio(["", "  "])).toBe(0);
  });
});

describe("normalize", () => {
  it("normalizes emails (trim, lowercase, invisible chars)", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
    expect(normalizeEmail("a\u200Bb@x.com")).toBe("ab@x.com");
  });
  it("derives full name", () => {
    expect(deriveFullName("Jane", "Doe")).toBe("Jane Doe");
    expect(deriveFullName(undefined, undefined, "Jane Doe")).toBe("Jane Doe");
    expect(deriveFullName(undefined, undefined, undefined)).toBeUndefined();
  });
});

describe("fuzzy", () => {
  it("levenshtein basic", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("jaro-winkler favours prefix", () => {
    expect(jaroWinkler("martha", "marhta")).toBeGreaterThan(0.9);
  });
  it("name similarity is diacritics-insensitive", () => {
    expect(nameSimilarity("Tomáš", "Tomas").score).toBe(1);
    expect(nameSimilarity("Jan Novák", "Jan Novak").score).toBe(1);
  });
});

describe("dedupe", () => {
  it("merges exact email duplicates and keeps multi custom values", () => {
    const result = dedupeContacts([
      contact({ email: "a@x.com", firstName: "Jana", customFields: { dogName: "Rex" } }),
      contact({ email: "A@X.com", customFields: { dogName: "Max" } }),
    ]);
    expect(result.merged).toHaveLength(1);
    expect(result.exactDuplicatesRemoved).toBe(1);
    expect(result.merged[0].customFields.dogName).toEqual(["Rex", "Max"]);
    expect(result.merged[0].firstName).toBe("Jana");
  });

  it("never auto-merges similar names with different emails, flags for review", () => {
    const result = dedupeContacts([
      contact({ email: "jan.novak@x.com", fullName: "Jan Novák" }),
      contact({ email: "j.novak@y.com", fullName: "Jan Novak" }),
    ]);
    expect(result.merged).toHaveLength(2);
    expect(result.nearDuplicates.length).toBeGreaterThan(0);
  });
});
