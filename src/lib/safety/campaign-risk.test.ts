import { describe, it, expect } from "vitest";
import { assessCampaignRisk, type RiskInput } from "@/lib/safety/campaign-risk";

const base: RiskInput = {
  campaign: {
    subject: "You're invited back to the dog meetup",
    previewText: "See you again this year",
    plainTextBody:
      "Hi there,\n\nYou attended last year and we'd love to see you again. Register before June 1.\n\nYou can unsubscribe any time using {{unsubscribe_url}}.",
    htmlBody: "<p>Hi there</p>",
    fromName: "Dog Club",
    fromEmail: "club@example.com",
  },
  totalContacts: 100,
  invalidContacts: 2,
  smtpConfigured: true,
  testSendCompleted: true,
  unresolvedRequiredVariables: [],
};

describe("assessCampaignRisk", () => {
  it("returns low risk for a clean campaign", () => {
    const r = assessCampaignRisk(base);
    expect(r.canSend).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.level).toBe("low");
  });

  it("blocks sending with missing subject, sender, unsubscribe", () => {
    const r = assessCampaignRisk({
      ...base,
      campaign: {
        ...base.campaign,
        subject: "",
        fromEmail: "",
        plainTextBody: "short",
        htmlBody: "",
      },
      smtpConfigured: false,
    });
    expect(r.canSend).toBe(false);
    expect(r.level).toBe("high");
    const ids = r.blockers.map((b) => b.id);
    expect(ids).toContain("missing_subject");
    expect(ids).toContain("missing_sender_email");
    expect(ids).toContain("smtp_not_configured");
    expect(ids).toContain("missing_unsubscribe");
  });

  it("blocks on unresolved required variables", () => {
    const r = assessCampaignRisk({ ...base, unresolvedRequiredVariables: ["firstName"] });
    expect(r.canSend).toBe(false);
    expect(r.blockers.map((b) => b.id)).toContain("unresolved_variables");
  });
});
