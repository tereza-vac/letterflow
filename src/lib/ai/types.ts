import { z } from "zod";

/** Structured, machine-parseable result the UI renders part-by-part. */
export const GeneratedEmail = z.object({
  subjectOptions: z.array(z.string()).min(1),
  recommendedSubject: z.string(),
  previewText: z.string(),
  plainTextBody: z.string(),
  htmlBody: z.string(),
  footer: z.string(),
  missingInfoWarnings: z.array(z.string()).default([]),
  toneNotes: z.array(z.string()).default([]),
  personalizationSuggestions: z.array(z.string()).default([]),
});
export type GeneratedEmail = z.infer<typeof GeneratedEmail>;

/** Provider-agnostic configuration. */
export interface AiProviderConfig {
  /** Provider id, e.g. "openai". */
  provider: string;
  /** Base URL for OpenAI-compatible endpoints. */
  baseUrl: string;
  model: string;
}

/** The exact, minimized payload that will be sent to the AI provider. */
export interface AiPayload {
  brief: string;
  contextText: string;
  /** Anonymized field names only (e.g. ["email", "firstName", "custom.dogName"]). */
  fieldNames: string[];
  /** Optional anonymized sample rows (values masked) — only if user consents. */
  anonymizedSamples?: Array<Record<string, string>>;
  campaignType: "campaign" | "transactional";
}

export interface GenerateOptions {
  config: AiProviderConfig;
  apiKey: string;
  payload: AiPayload;
  signal?: AbortSignal;
}

/** Common interface implemented by each AI provider. */
export interface AiProvider {
  id: string;
  label: string;
  generateEmail(options: GenerateOptions): Promise<GeneratedEmail>;
  /** Lightweight reachability/auth check. */
  testConnection(config: AiProviderConfig, apiKey: string): Promise<void>;
}
