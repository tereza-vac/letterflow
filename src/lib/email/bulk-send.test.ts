import { describe, it, expect } from "vitest";
import {
  selectBulkRecipients,
  alreadySentRecipients,
} from "@/lib/email/bulk-send";
import type { BulkSendLog, Contact, ContactStatus } from "@/lib/types";

function contact(
  email: string,
  status: ContactStatus = "active",
  id = email,
): Contact {
  return {
    id,
    email,
    normalizedEmail: email.trim().toLowerCase(),
    status,
    customFields: {},
    createdAt: "",
    updatedAt: "",
  };
}

describe("selectBulkRecipients", () => {
  it("keeps active, valid, non-suppressed contacts", () => {
    const res = selectBulkRecipients({
      contacts: [contact("a@example.com"), contact("b@example.com")],
      suppressedEmails: [],
      alreadySent: [],
    });
    expect(res.eligible.map((c) => c.email)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(res.skipped).toHaveLength(0);
  });

  it("skips unsubscribed and invalid-status contacts", () => {
    const res = selectBulkRecipients({
      contacts: [
        contact("a@example.com", "unsubscribed"),
        contact("b@example.com", "invalid"),
        contact("c@example.com", "active"),
      ],
      suppressedEmails: [],
      alreadySent: [],
    });
    expect(res.eligible.map((c) => c.email)).toEqual(["c@example.com"]);
    expect(res.skipCounts.unsubscribed).toBe(2);
  });

  it("skips contacts on the suppression list (case-insensitive)", () => {
    const res = selectBulkRecipients({
      contacts: [contact("Keep@example.com"), contact("Drop@example.com")],
      suppressedEmails: ["drop@example.com"],
      alreadySent: [],
    });
    expect(res.eligible.map((c) => c.email)).toEqual(["Keep@example.com"]);
    expect(res.skipCounts.suppressed).toBe(1);
  });

  it("skips malformed email addresses", () => {
    const res = selectBulkRecipients({
      contacts: [contact("not-an-email"), contact("ok@example.com")],
      suppressedEmails: [],
      alreadySent: [],
    });
    expect(res.eligible.map((c) => c.email)).toEqual(["ok@example.com"]);
    expect(res.skipCounts.invalid_email).toBe(1);
  });

  it("skips already-sent recipients", () => {
    const res = selectBulkRecipients({
      contacts: [contact("a@example.com"), contact("b@example.com")],
      suppressedEmails: [],
      alreadySent: ["a@example.com"],
    });
    expect(res.eligible.map((c) => c.email)).toEqual(["b@example.com"]);
    expect(res.skipCounts.already_sent).toBe(1);
  });
});

describe("alreadySentRecipients", () => {
  const log = (over: Partial<BulkSendLog>): BulkSendLog => ({
    id: "l",
    campaignId: "c1",
    startedAt: "",
    finishedAt: "",
    dryRun: false,
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    delayMs: 0,
    results: [],
    ...over,
  });

  it("collects successful sends for the campaign, ignoring dry runs and other campaigns", () => {
    const logs: BulkSendLog[] = [
      log({
        results: [
          { email: "A@example.com", status: "sent" },
          { email: "fail@example.com", status: "failed" },
        ],
      }),
      log({ dryRun: true, results: [{ email: "dry@example.com", status: "sent" }] }),
      log({ campaignId: "other", results: [{ email: "x@example.com", status: "sent" }] }),
    ];
    expect(alreadySentRecipients(logs, "c1").sort()).toEqual(["a@example.com"]);
  });
});
