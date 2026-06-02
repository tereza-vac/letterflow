import type { Contact } from "@/lib/types";
import { useAppStore } from "@/app/store";

/**
 * Development-only sample data to speed up manual testing of the
 * brief -> generate -> edit flow. Never imported in production paths; the
 * Welcome screen only renders the trigger button when `import.meta.env.DEV`.
 */
const SAMPLE_BRIEF =
  "Potřebuju napsat e-mail s customizovanou pozvánkou na další ročník téhle akce. Má znít přátelsky, ne korporátně. Zmiň psy, registraci, web a možnost odhlášení.";

const SOURCE_URLS = ["https://hafiada.cz/"];

function sampleContacts(): Contact[] {
  const now = new Date().toISOString();
  const make = (
    i: number,
    email: string,
    firstName: string,
    dogName: string,
    city: string,
  ): Contact => ({
    id: `seed_${i}`,
    email,
    normalizedEmail: email.toLowerCase(),
    firstName,
    fullName: firstName,
    status: "active",
    customFields: { dogName, city },
    createdAt: now,
    updatedAt: now,
  });
  return [
    make(1, "tereza@example.com", "Tereza", "Rex", "Praha"),
    make(2, "jan@example.com", "Jan", "Bella", "Brno"),
    make(3, "petra@example.com", "Petra", "Max", "Ostrava"),
  ];
}

/** Populate the store with a ready-to-test campaign and contacts. */
export function loadTestData() {
  const s = useAppStore.getState();
  s.setContacts(sampleContacts());
  s.setSourceUrls(SOURCE_URLS);
  s.updateCampaign({
    name: "Hafiáda pozvánky",
    brief: SAMPLE_BRIEF,
    fromName: "Hafiáda",
    fromEmail: "vacina.tereza@gmail.com",
  });
  s.setStep("generate");
}
