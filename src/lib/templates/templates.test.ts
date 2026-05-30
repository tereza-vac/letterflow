import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/templates/render-template";
import { validateTemplate } from "@/lib/templates/validate-template";
import type { Contact } from "@/lib/types";

function c(p: Partial<Contact>): Contact {
  const now = new Date().toISOString();
  return {
    id: Math.random().toString(36),
    email: "a@b.com",
    normalizedEmail: "a@b.com",
    status: "active",
    customFields: {},
    createdAt: now,
    updatedAt: now,
    ...p,
  };
}

describe("renderTemplate", () => {
  it("resolves known variables", () => {
    const r = renderTemplate("Hi {{ firstName }} <{{ email }}>", c({ firstName: "Jana", email: "j@x.com", normalizedEmail: "j@x.com" }));
    expect(r.output).toBe("Hi Jana <j@x.com>");
    expect(r.unresolved).toEqual([]);
  });

  it("uses fallback when missing", () => {
    const r = renderTemplate('Hi {{ firstName | default: "there" }}', c({ firstName: undefined }));
    expect(r.output).toBe("Hi there");
    expect(r.usedFallback).toContain("firstName");
  });

  it("keeps unresolved markers visible and reports them", () => {
    const r = renderTemplate("Hi {{ firstName }}", c({ firstName: undefined }));
    expect(r.output).toBe("Hi {{ firstName }}");
    expect(r.unresolved).toContain("firstName");
  });

  it("resolves custom fields and joins arrays", () => {
    const r = renderTemplate("Dogs: {{ custom.dogName }}", c({ customFields: { dogName: ["Rex", "Max"] } }));
    expect(r.output).toBe("Dogs: Rex, Max");
  });
});

describe("validateTemplate", () => {
  it("counts missing variables and flags unknowns", () => {
    const contacts = [
      c({ firstName: "Jana" }),
      c({ firstName: undefined }),
      c({ firstName: undefined }),
    ];
    const v = validateTemplate(["Hi {{ firstName }} {{ nope }}"], contacts);
    const first = v.variables.find((x) => x.path === "firstName")!;
    expect(first.missingCount).toBe(2);
    expect(v.unknownVariables).toContain("nope");
  });
});
