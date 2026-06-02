import { z } from "zod";

/**
 * Central domain types for letterflow. Shared by the local logic library,
 * the storage layer, and the UI. Kept dependency-free (only zod) so the same
 * code runs in tests, the browser dev server, and the Tauri webview.
 */

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const ContactStatus = z.enum([
  "active",
  "invalid",
  "unsubscribed",
  "suppressed",
]);
export type ContactStatus = z.infer<typeof ContactStatus>;

export const Contact = z.object({
  id: z.string(),
  email: z.string(),
  normalizedEmail: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  status: ContactStatus,
  /** Arbitrary extra columns mapped during import (e.g. dogName, city). */
  customFields: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  sourceFileId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contact = z.infer<typeof Contact>;

/** A raw parsed row before normalization/validation. */
export type RawRow = Record<string, string>;

/** A parsed tabular file (CSV/XLSX). */
export interface ParsedTable {
  fileName: string;
  headers: string[];
  rows: RawRow[];
}

// ---------------------------------------------------------------------------
// Column detection / mapping
// ---------------------------------------------------------------------------

/** Canonical contact fields letterflow understands natively. */
export type CanonicalField =
  | "email"
  | "firstName"
  | "lastName"
  | "fullName"
  | "company"
  | "phone"
  | "city"
  | "note"
  | "custom"
  | "ignore";

export interface ColumnDetection {
  header: string;
  /** Best-guess canonical field for this column. */
  suggestedField: CanonicalField;
  /** Suggested custom field key when suggestedField === "custom". */
  suggestedCustomKey?: string;
  /** 0..1 confidence in the suggestion. */
  confidence: number;
  /** Human-readable reasons that explain the confidence score. */
  reasons: string[];
  /** A few non-empty sample values for the UI. */
  sampleValues: string[];
}

/** A user-confirmed (or auto-applied) mapping from a header to a field. */
export interface ColumnMapping {
  header: string;
  field: CanonicalField;
  customKey?: string;
}

// ---------------------------------------------------------------------------
// Import results
// ---------------------------------------------------------------------------

export type ImportIssueKind =
  | "invalid_email"
  | "missing_email"
  | "exact_duplicate"
  | "near_duplicate"
  | "missing_required_field"
  | "suspicious_value";

export interface ImportIssue {
  kind: ImportIssueKind;
  message: string;
  /** Index into the produced contact array (or raw row index for parse issues). */
  contactIndex?: number;
  relatedIndex?: number;
  score?: number;
}

export interface ImportSummary {
  totalRows: number;
  validContacts: number;
  invalidEmails: number;
  missingEmails: number;
  exactDuplicatesRemoved: number;
  nearDuplicatesForReview: number;
  missingRequiredFields: number;
  customFieldsDetected: string[];
}

export interface ImportResult {
  contacts: Contact[];
  invalid: Contact[];
  needsReview: ImportIssue[];
  issues: ImportIssue[];
  summary: ImportSummary;
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export interface FieldQuality {
  field: string;
  total: number;
  missing: number;
  missingRate: number;
  inconsistentFormat?: boolean;
  longValues: number;
  withDiacritics: number;
  withSpecialChars: number;
}

export interface QualityReport {
  totalContacts: number;
  invalidEmailRate: number;
  duplicateRate: number;
  suspiciousRows: number;
  fields: FieldQuality[];
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export const CampaignStatus = z.enum(["draft", "ready", "tested", "exported"]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export type RiskLevel = "low" | "medium" | "high";

export interface RiskReason {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  fix: string;
}

export interface Campaign {
  id: string;
  name: string;
  brief: string;
  subject: string;
  previewText: string;
  plainTextBody: string;
  htmlBody: string;
  fromName: string;
  fromEmail: string;
  status: CampaignStatus;
  riskLevel: RiskLevel;
  riskReasons: RiskReason[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Uploaded files
// ---------------------------------------------------------------------------

export type DetectedFileType = "contacts" | "context" | "unknown";

export interface UploadedFile {
  id: string;
  name: string;
  extension: "xlsx" | "csv" | "md" | "txt";
  detectedType: DetectedFileType;
  /** User override; when set it wins over detectedType. */
  overrideType?: DetectedFileType;
  size: number;
  /** Parsed table for contact files. */
  table?: ParsedTable;
  /** Extracted text for context files. */
  contextText?: string;
  createdAt: string;
}

export function effectiveFileType(f: UploadedFile): DetectedFileType {
  return f.overrideType ?? f.detectedType;
}

// ---------------------------------------------------------------------------
// Test send log
// ---------------------------------------------------------------------------

export interface TestSendLog {
  id: string;
  campaignId: string;
  recipient: string;
  timestamp: string;
  status: "success" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// Bulk send (guarded, opt-in developer feature)
// ---------------------------------------------------------------------------

export interface BulkRecipientResult {
  email: string;
  status: "sent" | "failed";
  error?: string;
}

/** Summary of one bulk-send run, persisted so re-runs can skip already-sent. */
export interface BulkSendLog {
  id: string;
  campaignId: string;
  startedAt: string;
  finishedAt: string;
  /** A dry run renders every message but sends nothing. */
  dryRun: boolean;
  /** Number of eligible recipients the run attempted. */
  total: number;
  sent: number;
  failed: number;
  /** Recipients skipped before the run (suppressed / invalid / already sent). */
  skipped: number;
  /** Delay between individual sends, in milliseconds. */
  delayMs: number;
  /** Per-recipient outcome for attempted (non-skipped) sends. */
  results: BulkRecipientResult[];
}
