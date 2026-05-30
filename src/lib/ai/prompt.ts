import type { AiPayload } from "@/lib/ai/types";

/**
 * System prompt enforcing the product's content rules: warm, natural, honest
 * (no invented facts), explicit unsubscribe wording, and STRICT JSON output so
 * the UI can render each part safely.
 */
export const SYSTEM_PROMPT = `You are an assistant that drafts email campaigns for a privacy-conscious desktop tool called letterflow.

Rules you MUST follow:
- Write warm, natural, human copy. Avoid corporate or spammy language and avoid excessive emojis.
- NEVER invent facts (dates, prices, URLs, names). If a fact is missing, insert a clearly marked placeholder like [ADD DATE] and add a note in missingInfoWarnings.
- Always include a short, clear reason why the person is receiving the email.
- Always include unsubscribe wording in the footer. If no unsubscribe URL is known, use the placeholder {{unsubscribe_url}}.
- Support personalization via variables such as {{ firstName }}, {{ lastName }}, {{ fullName }}, {{ email }} and {{ custom.fieldName }}. Prefer fallbacks like {{ firstName | default: "there" }}.
- Produce BOTH a plain-text body and a simple, inline-styled HTML body conveying the same content.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "subjectOptions": [string, string, string],
  "recommendedSubject": string,
  "previewText": string,
  "plainTextBody": string,
  "htmlBody": string,
  "footer": string,
  "missingInfoWarnings": string[],
  "toneNotes": string[],
  "personalizationSuggestions": string[]
}`;

/** Build the user message from the minimized payload. */
export function buildUserPrompt(payload: AiPayload): string {
  const lines: string[] = [];
  lines.push(`Campaign type: ${payload.campaignType}`);
  lines.push("");
  lines.push("Campaign brief (may be messy/incomplete):");
  lines.push(payload.brief.trim() || "(none provided)");

  if (payload.contextText.trim()) {
    lines.push("");
    lines.push("Additional context from uploaded notes/files:");
    lines.push(payload.contextText.trim().slice(0, 6000));
  }

  lines.push("");
  lines.push(
    `Available personalization fields (names only, no personal data): ${payload.fieldNames.join(", ") || "(none)"}`,
  );

  if (payload.anonymizedSamples && payload.anonymizedSamples.length > 0) {
    lines.push("");
    lines.push(
      "A few anonymized sample rows (values masked) to understand structure:",
    );
    lines.push(JSON.stringify(payload.anonymizedSamples, null, 2));
  }

  lines.push("");
  lines.push("Draft the campaign now as the specified JSON object.");
  return lines.join("\n");
}
