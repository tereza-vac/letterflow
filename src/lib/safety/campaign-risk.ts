import type { Campaign, RiskLevel, RiskReason } from "@/lib/types";

export interface RiskInput {
  campaign: Pick<
    Campaign,
    | "subject"
    | "previewText"
    | "plainTextBody"
    | "htmlBody"
    | "fromName"
    | "fromEmail"
  >;
  totalContacts: number;
  invalidContacts: number;
  smtpConfigured: boolean;
  testSendCompleted: boolean;
  /** Template variables that don't resolve for at least one contact. */
  unresolvedRequiredVariables: string[];
  /** Whether bulk sending is being attempted (future feature). */
  bulkSend?: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0..100, higher = riskier
  reasons: RiskReason[];
  /** Critical reasons that must block sending. */
  blockers: RiskReason[];
  canSend: boolean;
}

const UNSUBSCRIBE_RE =
  /\b(unsubscribe|opt[\s-]?out|odhl[aá]sit|odhl[aá][sš]en[ií]|zru[sš]it odb[eě]r)\b/i;
const SPAM_WORDS = [
  "free",
  "100%",
  "guarantee",
  "act now",
  "limited time",
  "click here",
  "winner",
  "cash",
  "risk-free",
  "buy now",
  "order now",
  "viagra",
];

function countLinks(text: string): number {
  return (text.match(/https?:\/\/[^\s)"']+/gi) ?? []).length;
}

function countEmojis(text: string): number {
  // Match common emoji ranges (approximate, good enough for a warning).
  const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu;
  return (text.match(re) ?? []).length;
}

/**
 * Compute a transparent campaign risk assessment. Each reason carries a
 * severity and a concrete suggested fix. Critical issues become blockers that
 * prevent sending until resolved (per the product safety rules).
 */
export function assessCampaignRisk(input: RiskInput): RiskAssessment {
  const { campaign: c } = input;
  const reasons: RiskReason[] = [];
  const add = (
    id: string,
    severity: RiskReason["severity"],
    message: string,
    fix: string,
  ) => reasons.push({ id, severity, message, fix });

  const bodyText = `${c.plainTextBody}\n${c.htmlBody}`;

  // --- Critical / blocking checks ---
  if (!c.subject.trim())
    add("missing_subject", "critical", "Subject line is empty.", "Add a clear, specific subject line.");
  if (c.subject.length > 78)
    add("subject_too_long", "warning", `Subject is ${c.subject.length} characters (over 78).`, "Shorten the subject so it isn't truncated in inboxes.");
  if (!c.plainTextBody.trim() && !c.htmlBody.trim())
    add("missing_body", "critical", "Email body is empty.", "Write or generate the email content.");
  if (!c.fromEmail.trim())
    add("missing_sender_email", "critical", "Sender email is not set.", "Set a sender email in Settings.");
  if (!c.fromName.trim())
    add("missing_sender_name", "warning", "Sender name is not set.", "Add a friendly sender name in Settings.");
  if (!input.smtpConfigured)
    add("smtp_not_configured", "critical", "SMTP is not configured.", "Configure SMTP in Settings and run a connection test.");
  if (!UNSUBSCRIBE_RE.test(bodyText))
    add("missing_unsubscribe", "critical", "No unsubscribe wording or placeholder found.", "Add an unsubscribe line or {{unsubscribe_url}} placeholder to the footer.");
  if (input.unresolvedRequiredVariables.length > 0)
    add("unresolved_variables", "critical", `Unresolved template variables: ${input.unresolvedRequiredVariables.join(", ")}.`, "Add fallbacks (e.g. {{ firstName | default: \"there\" }}) or remove the variables.");

  // --- Warnings (raise risk, don't block) ---
  if (!c.plainTextBody.trim())
    add("missing_plain_text", "warning", "No plain-text version of the email.", "Provide a plain-text body for better deliverability and accessibility.");
  if (!input.testSendCompleted)
    add("no_test_send", "warning", "No test send has been completed yet.", "Send one test email to yourself before exporting or sending.");
  if (c.plainTextBody.trim().length > 0 && c.plainTextBody.trim().length < 40)
    add("body_too_short", "warning", "Email body is very short.", "Expand the message so it reads as a real email.");

  const invalidRate = input.totalContacts > 0 ? input.invalidContacts / (input.totalContacts + input.invalidContacts) : 0;
  if (invalidRate > 0.2)
    add("high_invalid_rate", "warning", `High invalid contact rate (${Math.round(invalidRate * 100)}%).`, "Clean or remove invalid contacts before sending.");

  const links = countLinks(bodyText);
  if (links > 8)
    add("too_many_links", "warning", `Email contains ${links} links.`, "Reduce the number of links to avoid spam filters.");

  const lowerBody = bodyText.toLowerCase();
  const spamHits = SPAM_WORDS.filter((w) => lowerBody.includes(w));
  if (spamHits.length >= 3)
    add("spammy_words", "warning", `Spam-trigger words detected: ${spamHits.slice(0, 5).join(", ")}.`, "Rephrase to sound natural and avoid salesy clichés.");

  if (/[!?]{3,}/.test(bodyText) || (bodyText.match(/!/g) ?? []).length > 6)
    add("excessive_punctuation", "warning", "Excessive punctuation detected.", "Use punctuation sparingly.");

  const emojis = countEmojis(`${c.subject} ${bodyText}`);
  if (emojis > 5)
    add("too_many_emojis", "warning", `Contains ${emojis} emojis.`, "Use at most a couple of emojis.");

  if (input.bulkSend && input.totalContacts > 500)
    add("large_recipient_count", "warning", `Large recipient count (${input.totalContacts}).`, "Bulk sending should go through a dedicated email platform with proper deliverability.");

  // --- Aggregate ---
  const blockers = reasons.filter((r) => r.severity === "critical");
  const warnings = reasons.filter((r) => r.severity === "warning");
  const score = Math.min(100, blockers.length * 30 + warnings.length * 8);

  let level: RiskLevel = "low";
  if (blockers.length > 0 || score >= 50) level = "high";
  else if (warnings.length > 0 || score >= 20) level = "medium";

  return {
    level,
    score,
    reasons,
    blockers,
    canSend: blockers.length === 0,
  };
}
