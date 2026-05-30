import { create } from "zustand";
import type {
  Campaign,
  ColumnMapping,
  Contact,
  ImportResult,
  UploadedFile,
} from "@/lib/types";
import type { AiProviderConfig } from "@/lib/ai/types";
import type { SmtpConfig } from "@/lib/email/types";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/generate-email";
import { DEFAULT_SMTP_CONFIG } from "@/lib/email/types";
import type { TestSendLog } from "@/lib/types";
import { getPersistAdapter } from "@/lib/storage/persist";

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
  | "export";

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
  testSendLogs: TestSendLog[];
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
  addTestSendLog: (log: TestSendLog) => void;
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
    testSendLogs: s.testSendLogs,
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
  testSendLogs: [],
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
    addTestSendLog: (log) =>
      mutate({ testSendLogs: [log, ...get().testSendLogs] }),
    setDeveloperBulk: (developerBulkEnabled) => mutate({ developerBulkEnabled }),
    setAiIncludeSamples: (aiIncludeSamples) => mutate({ aiIncludeSamples }),

    resetAll: () => mutate({ ...initialPersisted, campaign: newCampaign() }),

    hydrate: async () => {
      const data = await getPersistAdapter().load<PersistedState>();
      if (data) set({ ...data });
      set({ hydrated: true });
    },
  };
});
