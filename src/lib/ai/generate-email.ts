import type { Contact } from "@/lib/types";
import {
  type AiPayload,
  type AiProvider,
  type AiProviderConfig,
  type GeneratedEmail,
} from "@/lib/ai/types";
import { openAiProvider } from "@/lib/ai/providers/openai";

/** Registry so additional providers (Azure, local, etc.) can be added later. */
const PROVIDERS: Record<string, AiProvider> = {
  [openAiProvider.id]: openAiProvider,
};

export function getAiProvider(id: string): AiProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown AI provider: ${id}`);
  return p;
}

export function listAiProviders(): AiProvider[] {
  return Object.values(PROVIDERS);
}

/** Mask a value while preserving its rough shape (length / kind) for the AI. */
function maskValue(field: string, value: string): string {
  if (!value) return "";
  if (field === "email" || value.includes("@")) return "name@example.com";
  if (/^\+?\d[\d\s-]+$/.test(value)) return "+000000000";
  // Replace letters/digits but keep word boundaries so structure is visible.
  return value.replace(/\p{L}/gu, "x").replace(/\d/g, "0");
}

/**
 * Build the minimized payload sent to the AI. By default only field NAMES are
 * shared (no personal data). Sample rows are included ONLY when the user
 * explicitly consents, and even then values are masked.
 */
export function buildAiPayload(args: {
  brief: string;
  contextText: string;
  fieldNames: string[];
  contacts?: Contact[];
  includeAnonymizedSamples?: boolean;
  sampleCount?: number;
  campaignType?: "campaign" | "transactional";
}): AiPayload {
  const {
    brief,
    contextText,
    fieldNames,
    contacts = [],
    includeAnonymizedSamples = false,
    sampleCount = 3,
    campaignType = "campaign",
  } = args;

  let anonymizedSamples: Array<Record<string, string>> | undefined;
  if (includeAnonymizedSamples && contacts.length > 0) {
    anonymizedSamples = contacts.slice(0, sampleCount).map((c) => {
      const row: Record<string, string> = {
        email: maskValue("email", c.email),
        firstName: maskValue("firstName", c.firstName ?? ""),
        lastName: maskValue("lastName", c.lastName ?? ""),
      };
      for (const [k, v] of Object.entries(c.customFields)) {
        row[`custom.${k}`] = maskValue(k, Array.isArray(v) ? v.join(", ") : v);
      }
      return row;
    });
  }

  return {
    brief,
    contextText,
    fieldNames,
    anonymizedSamples,
    campaignType,
  };
}

/** Generate a structured email draft using the selected provider. */
export async function generateEmail(args: {
  config: AiProviderConfig;
  apiKey: string;
  payload: AiPayload;
  signal?: AbortSignal;
}): Promise<GeneratedEmail> {
  const provider = getAiProvider(args.config.provider);
  return provider.generateEmail(args);
}

export const DEFAULT_AI_CONFIG: AiProviderConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};
