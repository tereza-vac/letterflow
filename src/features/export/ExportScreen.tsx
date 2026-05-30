import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileJson, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  contactsToCsv,
  contactsToXlsx,
  campaignArchiveJson,
  importReportText,
  saveFile,
} from "@/lib/export/exporters";

export function ExportScreen() {
  const { campaign, contacts, importResult, updateCampaign } = useAppStore();
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  async function save(name: string, data: string | Uint8Array, mime?: string) {
    const result = await saveFile(name, data, mime);
    if (result) {
      setLastSaved(name);
      updateCampaign({ status: "exported" });
    }
  }

  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
  const invalid = importResult?.invalid ?? [];
  const review = importResult
    ? importResult.contacts.filter((_, i) => importResult.needsReview.some((r) => r.contactIndex === i))
    : [];

  return (
    <div>
      <StepHeader
        title="Export"
        description="Take your cleaned contacts and campaign anywhere — including professional senders like Ecomail, Mailchimp, MailerLite or Brevo for production sending."
        badge={null}
      />

      {lastSaved && (
        <Alert variant="success" className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Saved {lastSaved}.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5 text-success" />}
          title="Cleaned contacts (CSV)"
          desc={`${contacts.length} valid contacts`}
          onClick={() => save(`${slug}-contacts.csv`, contactsToCsv(contacts), "text/csv")}
          disabled={contacts.length === 0}
        />
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5 text-success" />}
          title="Cleaned contacts (XLSX)"
          desc={`${contacts.length} valid contacts`}
          onClick={() => save(`${slug}-contacts.xlsx`, contactsToXlsx(contacts))}
          disabled={contacts.length === 0}
        />
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5 text-destructive" />}
          title="Invalid contacts (CSV)"
          desc={`${invalid.length} invalid`}
          onClick={() => save(`${slug}-invalid.csv`, contactsToCsv(invalid), "text/csv")}
          disabled={invalid.length === 0}
        />
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5 text-warning" />}
          title="Needs review (CSV)"
          desc={`${review.length} near-duplicates`}
          onClick={() => save(`${slug}-review.csv`, contactsToCsv(review), "text/csv")}
          disabled={review.length === 0}
        />
        <ExportCard
          icon={<FileText className="h-5 w-5 text-primary" />}
          title="Campaign plain text"
          desc="Subject + plain-text body"
          onClick={() => save(`${slug}.txt`, `Subject: ${campaign.subject}\n\n${campaign.plainTextBody}`, "text/plain")}
        />
        <ExportCard
          icon={<FileText className="h-5 w-5 text-primary" />}
          title="Campaign HTML"
          desc="Ready-to-paste HTML body"
          onClick={() => save(`${slug}.html`, campaign.htmlBody, "text/html")}
        />
        <ExportCard
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          title="Import report"
          desc="Summary + all issues"
          onClick={() => importResult && save(`${slug}-import-report.txt`, importReportText(importResult), "text/plain")}
          disabled={!importResult}
        />
        <ExportCard
          icon={<FileJson className="h-5 w-5 text-muted-foreground" />}
          title="Campaign archive (JSON)"
          desc="Everything in one file"
          onClick={() => save(`${slug}-archive.json`, campaignArchiveJson(campaign, contacts, importResult), "application/json")}
        />
      </div>

      <Alert variant="info" className="mt-6">
        <Download className="h-4 w-4" />
        <AlertDescription>
          Production bulk sending needs proper deliverability setup (SPF, DKIM,
          DMARC, unsubscribe handling). For real campaigns, import these exports
          into a dedicated email platform.
        </AlertDescription>
      </Alert>

      <StepFooter hideBack={false} />
    </div>
  );
}

function ExportCard({
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={onClick} disabled={disabled}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </CardContent>
    </Card>
  );
}
