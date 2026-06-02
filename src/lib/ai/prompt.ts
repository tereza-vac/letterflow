import type { AiPayload, EmailDraft, RefineOptions, RewriteOptions } from "@/lib/ai/types";

/**
 * System prompt enforcing the product's content rules: warm, natural, honest
 * (no invented facts), explicit unsubscribe wording, and STRICT JSON output so
 * the UI can render each part safely.
 */
export const SYSTEM_PROMPT = `You are an assistant that drafts email campaigns for a privacy-conscious desktop tool called letterflow.

Rules you MUST follow:
- Write warm, natural, human copy. Avoid corporate or spammy language and avoid excessive emojis.
- When the user message contains a "Verified facts" section from fetched web pages, those values are AUTHORITATIVE. Use them exactly for event name, date, time, venue, address and URL. Do NOT substitute other years (e.g. do not write 2024 if verified facts say 2026), other cities, or invented program details.
- Do NOT rely on your general knowledge about an event, brand or location — only use facts explicitly present in the brief or the provided context (especially Verified facts).
- USE the facts found in uploaded notes and fetched web page content to fill concrete details such as dates, times, locations, prices and URLs.
- NEVER invent facts (dates, prices, URLs, names, venues, activities). Only when a fact is genuinely absent from the brief AND all provided context, insert a clearly marked placeholder like [ADD DATE] and add a note in missingInfoWarnings.
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
    lines.push(
      "Additional context from uploaded notes/files and fetched web pages.",
    );
    lines.push(
      "IMPORTANT: If a 'Verified facts' block appears below, treat it as the single source of truth for dates, venue and event name.",
    );
    lines.push(payload.contextText.trim().slice(0, 9000));
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

/** System prompt for refining an existing draft (whole-email mode). */
export const REFINE_SYSTEM_PROMPT = `You revise an existing email campaign for the privacy-conscious tool letterflow.

Rules:
- Apply the user's instructions while keeping everything else intact and consistent.
- Keep the same warm, natural tone. Do NOT invent facts; keep placeholders like [ADD DATE] unless the instructions or context supply the real value.
- Preserve personalization variables such as {{ firstName | default: "there" }} and {{ unsubscribe_url }} unless asked to change them.
- Keep the plain-text and HTML bodies consistent with each other.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly:
{
  "subject": string,
  "previewText": string,
  "plainTextBody": string,
  "htmlBody": string
}`;

export function buildRefinePrompt(options: RefineOptions): string {
  const { email, instructions, contextText, fieldNames } = options;
  const lines: string[] = [];
  lines.push("Current email draft:");
  lines.push(JSON.stringify(email satisfies EmailDraft, null, 2));
  lines.push("");
  lines.push("Instructions to apply:");
  lines.push(instructions.trim() || "(improve clarity and warmth without changing facts)");
  if (contextText?.trim()) {
    lines.push("");
    lines.push("Context you may use for facts (notes/files/pages):");
    lines.push(contextText.trim().slice(0, 9000));
  }
  if (fieldNames && fieldNames.length > 0) {
    lines.push("");
    lines.push(`Available personalization fields: ${fieldNames.join(", ")}`);
  }
  lines.push("");
  lines.push("Return the revised email as the specified JSON object.");
  return lines.join("\n");
}

/** System prompt for rewriting just a selected snippet. */
export const REWRITE_SYSTEM_PROMPT = `You rewrite a short selected snippet of an email for the tool letterflow.

Rules:
- Output ONLY the replacement text for the selection. No quotes, no explanation, no markdown fences.
- Match the surrounding tone and formatting. Do NOT invent facts; keep placeholders like [ADD DATE] unless given the real value.
- Preserve any personalization variables (e.g. {{ firstName }}, {{ unsubscribe_url }}) unless asked to change them.`;

export function buildRewritePrompt(options: RewriteOptions): string {
  const { field, selection, instructions, surroundingText } = options;
  const lines: string[] = [];
  lines.push(`Field: ${field}`);
  if (surroundingText?.trim()) {
    lines.push("");
    lines.push("Full field text (for context):");
    lines.push(surroundingText.trim().slice(0, 4000));
  }
  lines.push("");
  lines.push("Selected snippet to rewrite:");
  lines.push(selection);
  lines.push("");
  lines.push("Instructions:");
  lines.push(instructions.trim() || "(improve this snippet without changing its meaning)");
  lines.push("");
  lines.push("Output only the replacement text for the selected snippet.");
  return lines.join("\n");
}
