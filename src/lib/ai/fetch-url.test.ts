import { describe, it, expect } from "vitest";
import { formatEventFacts, extractUrlsFromText, collectSourceUrls } from "@/lib/ai/fetch-url";

describe("formatEventFacts", () => {
  it("formats schema.org Event with location", () => {
    const lines = formatEventFacts({
      name: "Hafiáda 2026",
      startDate: "2026-08-30T08:00:00+02:00",
      endDate: "2026-08-30T17:00:00+02:00",
      url: "https://hafiada.cz/",
      location: {
        name: "Areál před bazénem, ZŠ Bystřice",
        address: {
          streetAddress: "Bystřice 848",
          addressLocality: "Bystřice",
          addressRegion: "Frýdek-Místek",
          postalCode: "739 95",
        },
      },
    });
    expect(lines.some((l) => l.includes("Hafiáda 2026"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Start:"))).toBe(true);
    expect(lines.some((l) => l.includes("Bystřice"))).toBe(true);
    expect(lines.some((l) => l.includes("Frýdek-Místek"))).toBe(true);
  });
});

describe("extractUrlsFromText", () => {
  it("finds URLs in brief text", () => {
    const urls = extractUrlsFromText(
      "Pozvánka na akci https://hafiada.cz/ a další text.",
    );
    expect(urls).toEqual(["https://hafiada.cz/"]);
  });
});

describe("collectSourceUrls", () => {
  it("merges explicit links and brief URLs without duplicates", () => {
    const urls = collectSourceUrls(
      ["https://hafiada.cz/"],
      "Více info na https://hafiada.cz/program",
    );
    expect(urls).toContain("https://hafiada.cz/");
    expect(urls).toContain("https://hafiada.cz/program");
  });
});
