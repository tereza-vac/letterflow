import type { BulkSendLog, Contact } from "@/lib/types";
import { isValidEmail } from "@/lib/contacts/validate";

/**
 * Guarded bulk sending lives entirely on top of the single-message SMTP path.
 * The risky part is *who* gets a message, so recipient selection is a pure,
 * unit-tested function: it removes anyone who must never be contacted
 * (suppressed / unsubscribed / invalid) and anyone already sent to in a
 * previous non-dry run, leaving an auditable eligible list and a skip report.
 */

export type SkipReason =
  | "no_email"
  | "invalid_email"
  | "unsubscribed"
  | "suppressed"
  | "already_sent";

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  no_email: "No email address",
  invalid_email: "Invalid email address",
  unsubscribed: "Unsubscribed / invalid status",
  suppressed: "On suppression list",
  already_sent: "Already sent in a previous run",
};

export interface SkippedRecipient {
  contact: Contact;
  reason: SkipReason;
}

export interface BulkSelection {
  eligible: Contact[];
  skipped: SkippedRecipient[];
  skipCounts: Record<SkipReason, number>;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export interface SelectBulkParams {
  contacts: Contact[];
  /** Normalized emails on the local suppression list. */
  suppressedEmails: string[];
  /** Normalized emails already successfully sent to (for this campaign). */
  alreadySent: string[];
}

/**
 * Partition contacts into those eligible for a bulk send and those skipped,
 * with a concrete reason for every exclusion. Order of checks is intentional:
 * status/suppression take precedence over "already sent" so the skip report is
 * the most informative.
 */
export function selectBulkRecipients(params: SelectBulkParams): BulkSelection {
  const suppressed = new Set(params.suppressedEmails.map(normalize));
  const sent = new Set(params.alreadySent.map(normalize));

  const eligible: Contact[] = [];
  const skipped: SkippedRecipient[] = [];
  const skipCounts: Record<SkipReason, number> = {
    no_email: 0,
    invalid_email: 0,
    unsubscribed: 0,
    suppressed: 0,
    already_sent: 0,
  };

  const skip = (contact: Contact, reason: SkipReason) => {
    skipped.push({ contact, reason });
    skipCounts[reason] += 1;
  };

  for (const contact of params.contacts) {
    const email = (contact.normalizedEmail || contact.email || "").trim();
    const lower = normalize(email);

    if (!email) {
      skip(contact, "no_email");
      continue;
    }
    if (contact.status === "unsubscribed" || contact.status === "invalid") {
      skip(contact, "unsubscribed");
      continue;
    }
    if (contact.status === "suppressed" || suppressed.has(lower)) {
      skip(contact, "suppressed");
      continue;
    }
    if (!isValidEmail(email)) {
      skip(contact, "invalid_email");
      continue;
    }
    if (sent.has(lower)) {
      skip(contact, "already_sent");
      continue;
    }
    eligible.push(contact);
  }

  return { eligible, skipped, skipCounts };
}

/**
 * Collect the normalized recipients already sent to for a campaign across all
 * previous, non-dry-run bulk logs. Used to avoid double-sending.
 */
export function alreadySentRecipients(
  logs: BulkSendLog[],
  campaignId: string,
): string[] {
  const sent = new Set<string>();
  for (const log of logs) {
    if (log.dryRun || log.campaignId !== campaignId) continue;
    for (const r of log.results) {
      if (r.status === "sent") sent.add(normalize(r.email));
    }
  }
  return [...sent];
}
