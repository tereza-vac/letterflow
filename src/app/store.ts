import { create } from "zustand";
import type {
  Campaign,
  ColumnMapping,
  Contact,
  ImportResult,
  UploadedFile,
} from "@/lib/types";
import type { AiProviderConfig, GeneratedEmail } from "@/lib/ai/types";
import type { SmtpConfig } from "@/lib/email/types";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/generate-email";
import { DEFAULT_SMTP_CONFIG } from "@/lib/email/types";
import type { BulkSendLog, TestSendLog } from "@/lib/types";
import { getPersistAdapter } from "@/lib/storage/persist";
import { getSecureStore, SECRET_KEYS } from "@/lib/ai/secure-store";

export type Step =
  | "welcome"
  | "settings"
  | "upload"
  | "map"
  | "clean"
  | "brief"
  | "generate"
  | "edit"
  | "preview"
  | "test"
  | "export"
  | "bulk";

/**
 * Linear wizard order. "bulk" is intentionally NOT part of this sequence — it is
 * an advanced, opt-in step reached only when the developer toggle is enabled, so
 * the default flow ends at Export and never auto-navigates into bulk sending.
 */
export const STEP_ORDER: Step[] = [
  "welcome",
  "settings",
  "upload",
  "map",
  "clean",
  "brief",
  "generate",
  "edit",
  "preview",
  "test",
  "export",
];

function newCampaign(): Campaign {
  const now = new Date().toISOString();
  return {
    id: `camp_${Date.now().toString(36)}`,
    name: "Untitled campaign",
    brief: "",
    subject: "",
    previewText: "",
    plainTextBody: "",
    htmlBody: "",
    fromName: "",
    fromEmail: "",
    status: "draft",
    riskLevel: "low",
    riskReasons: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Non-secret slice that gets persisted to disk. Secrets live in secure store. */
interface PersistedState {
  aiConfig: AiProviderConfig;
  aiKeySaved: boolean;
  smtpConfig: SmtpConfig;
  smtpPasswordSaved: boolean;
  files: UploadedFile[];
  mappings: Record<string, ColumnMapping[]>;
  contacts: Contact[];
  importResult: ImportResult | null;
  campaign: Campaign;
  /** Source URLs whose content is fetched and fed to the AI as context. */
  sourceUrls: string[];
  /** Last AI-generated draft, kept so it survives navigation between steps. */
  generated: GeneratedEmail | null;
  testSendLogs: TestSendLog[];
  /** Normalized emails that must never receive a (bulk) send. */
  suppressedEmails: string[];
  /** History of bulk-send runs (used to skip already-sent recipients). */
  bulkSendLogs: BulkSendLog[];
  developerBulkEnabled: boolean;
  /** User consent to include anonymized sample rows in the AI payload. */
  aiIncludeSamples: boolean;
}

interface AppState extends PersistedState {
  step: Step;
  online: boolean;
  hydrated: boolean;

  setStep: (step: Step) => void;
  setOnline: (online: boolean) => void;

  setAiConfig: (config: Partial<AiProviderConfig>) => void;
  setAiKeySaved: (saved: boolean) => void;
  setSmtpConfig: (config: Partial<SmtpConfig>) => void;
  setSmtpPasswordSaved: (saved: boolean) => void;

  addFiles: (files: UploadedFile[]) => void;
  removeFile: (id: string) => void;
  updateFile: (id: string, patch: Partial<UploadedFile>) => void;

  setMappings: (fileId: string, mappings: ColumnMapping[]) => void;
  setImportResult: (result: ImportResult | null) => void;
  setContacts: (contacts: Contact[]) => void;

  updateCampaign: (patch: Partial<Campaign>) => void;
  setSourceUrls: (urls: string[]) => void;
  setGenerated: (generated: GeneratedEmail | null) => void;
  addTestSendLog: (log: TestSendLog) => void;
  addSuppressedEmails: (emails: string[]) => void;
  removeSuppressedEmail: (email: string) => void;
  addBulkSendLog: (log: BulkSendLog) => void;
  setDeveloperBulk: (enabled: boolean) => void;
  setAiIncludeSamples: (include: boolean) => void;

  resetAll: () => void;
  hydrate: () => Promise<void>;
}

function persistedSlice(s: AppState): PersistedState {
  return {
    aiConfig: s.aiConfig,
    aiKeySaved: s.aiKeySaved,
    smtpConfig: s.smtpConfig,
    smtpPasswordSaved: s.smtpPasswordSaved,
    files: s.files,
    mappings: s.mappings,
    contacts: s.contacts,
    importResult: s.importResult,
    campaign: s.campaign,
    sourceUrls: s.sourceUrls,
    generated: s.generated,
    testSendLogs: s.testSendLogs,
    suppressedEmails: s.suppressedEmails,
    bulkSendLogs: s.bulkSendLogs,
    developerBulkEnabled: s.developerBulkEnabled,
    aiIncludeSamples: s.aiIncludeSamples,
  };
}

const initialPersisted: PersistedState = {
  aiConfig: DEFAULT_AI_CONFIG,
  aiKeySaved: false,
  smtpConfig: DEFAULT_SMTP_CONFIG,
  smtpPasswordSaved: false,
  files: [],
  mappings: {},
  contacts: [],
  importResult: null,
  campaign: newCampaign(),
  sourceUrls: [],
  generated: null,
  testSendLogs: [],
  suppressedEmails: [],
  bulkSendLogs: [],
  developerBulkEnabled: false,
  aiIncludeSamples: false,
};

export const useAppStore = create<AppState>((set, get) => {
  // Debounced persistence so we don't hammer the adapter on every keystroke.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void getPersistAdapter().save(persistedSlice(get()));
    }, 400);
  };
  const mutate = (patch: Partial<AppState>) => {
    set(patch);
    schedulePersist();
  };

  return {
    ...initialPersisted,
    step: "welcome",
    online: true,
    hydrated: false,

    setStep: (step) => set({ step }),
    setOnline: (online) => set({ online }),

    setAiConfig: (config) =>
      mutate({ aiConfig: { ...get().aiConfig, ...config } }),
    setAiKeySaved: (aiKeySaved) => mutate({ aiKeySaved }),
    setSmtpConfig: (config) =>
      mutate({ smtpConfig: { ...get().smtpConfig, ...config } }),
    setSmtpPasswordSaved: (smtpPasswordSaved) => mutate({ smtpPasswordSaved }),

    addFiles: (files) => mutate({ files: [...get().files, ...files] }),
    removeFile: (id) =>
      mutate({ files: get().files.filter((f) => f.id !== id) }),
    updateFile: (id, patch) =>
      mutate({
        files: get().files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }),

    setMappings: (fileId, mappings) =>
      mutate({ mappings: { ...get().mappings, [fileId]: mappings } }),
    setImportResult: (importResult) =>
      mutate({
        importResult,
        contacts: importResult ? importResult.contacts : get().contacts,
      }),
    setContacts: (contacts) => mutate({ contacts }),

    updateCampaign: (patch) =>
      mutate({
        campaign: {
          ...get().campaign,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      }),
    setSourceUrls: (sourceUrls) => mutate({ sourceUrls }),
    setGenerated: (generated) => mutate({ generated }),
    addTestSendLog: (log) =>
      mutate({ testSendLogs: [log, ...get().testSendLogs] }),
    addSuppressedEmails: (emails) => {
      const normalized = emails
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      mutate({
        suppressedEmails: [
          ...new Set([...get().suppressedEmails, ...normalized]),
        ],
      });
    },
    removeSuppressedEmail: (email) =>
      mutate({
        suppressedEmails: get().suppressedEmails.filter(
          (e) => e !== email.trim().toLowerCase(),
        ),
      }),
    addBulkSendLog: (log) =>
      mutate({ bulkSendLogs: [log, ...get().bulkSendLogs] }),
    setDeveloperBulk: (developerBulkEnabled) => mutate({ developerBulkEnabled }),
    setAiIncludeSamples: (aiIncludeSamples) => mutate({ aiIncludeSamples }),

    resetAll: () => mutate({ ...initialPersisted, campaign: newCampaign() }),

    hydrate: async () => {
      const data = await getPersistAdapter().load<PersistedState>();
      if (data) set({ ...data });
      // The "saved" flags are persisted, but the actual secrets live in the
      // secure store. In the browser dev preview that store is memory-only and
      // is wiped on reload, so trust the store of record and re-sync the flags.
      // This also self-corrects if a secret was removed outside the app.
      const secure = getSecureStore();
      const [aiKey, smtpPass] = await Promise.all([
        secure.get(SECRET_KEYS.aiApiKey),
        secure.get(SECRET_KEYS.smtpPassword),
      ]);
      set({ aiKeySaved: !!aiKey, smtpPasswordSaved: !!smtpPass, hydrated: true });
    },
  };
});
