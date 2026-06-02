import { useMemo, useState } from "react";
import {
  Send,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  WifiOff,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assessCampaignRisk } from "@/lib/safety/campaign-risk";
import { validateTemplate } from "@/lib/templates/validate-template";
import { renderTemplate } from "@/lib/templates/render-template";
import { getSecureStore, SECRET_KEYS } from "@/lib/ai/secure-store";
import { smtpProvider } from "@/lib/email/providers/smtp";
import type { RiskLevel, Contact } from "@/lib/types";

const PLACEHOLDER: Contact = {
  id: "preview",
  email: "you@example.com",
  normalizedEmail: "you@example.com",
  firstName: "there",
  status: "active",
  customFields: {},
  createdAt: "",
  updatedAt: "",
};

export function TestSendScreen() {
  const { campaign, contacts, importResult, smtpConfig, smtpPasswordSaved, online, addTestSendLog, testSendLogs, updateCampaign, developerBulkEnabled, setStep } =
    useAppStore();
  const [testEmail, setTestEmail] = useState(smtpConfig.senderEmail);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const unresolvedRequired = useMemo(() => {
    const v = validateTemplate(
      [campaign.subject, campaign.previewText, campaign.plainTextBody, campaign.htmlBody],
      contacts,
    );
    const unknown = v.unknownVariables;
    const missingNoFallback = v.variables
      .filter((x) => x.known && !x.hasFallback && x.missingCount > 0)
      .map((x) => x.path);
    return [...new Set([...unknown, ...missingNoFallback])];
  }, [campaign, contacts]);

  const risk = useMemo(
    () =>
      assessCampaignRisk({
        campaign,
        totalContacts: contacts.length,
        invalidContacts: importResult?.invalid.length ?? 0,
        smtpConfigured: !!smtpConfig.host && smtpPasswordSaved,
        testSendCompleted: testSendLogs.some((l) => l.status === "success"),
        unresolvedRequiredVariables: unresolvedRequired,
      }),
    [campaign, contacts.length, importResult, smtpConfig, smtpPasswordSaved, testSendLogs, unresolvedRequired],
  );

  const sample = contacts[0] ?? PLACEHOLDER;
  const fromEmailForUnsub = campaign.fromEmail || smtpConfig.senderEmail || "";
  const systemVars = {
    unsubscribe_url: fromEmailForUnsub
      ? `mailto:${fromEmailForUnsub}?subject=Unsubscribe`
      : "https://example.com/unsubscribe",
  };
  const renderedSubject = renderTemplate(campaign.subject, sample, systemVars).output;

  async function doSend() {
    setSending(true);
    setSendResult(null);
    const password = (await getSecureStore().get(SECRET_KEYS.smtpPassword)) ?? "";
    const result = await smtpProvider.sendOne(
      { ...smtpConfig },
      password,
      {
        to: testEmail,
        fromName: campaign.fromName || smtpConfig.senderName,
        fromEmail: campaign.fromEmail || smtpConfig.senderEmail,
        subject: renderedSubject,
        text: renderTemplate(campaign.plainTextBody, sample, systemVars).output,
        html: renderTemplate(campaign.htmlBody, sample, systemVars).output,
      },
    );
    addTestSendLog({
      id: `log_${Date.now().toString(36)}`,
      campaignId: campaign.id,
      recipient: testEmail,
      timestamp: new Date().toISOString(),
      status: result.ok ? "success" : "error",
      error: result.error,
    });
    if (result.ok) updateCampaign({ status: "tested" });
    setSendResult({ ok: result.ok, message: result.ok ? "Test email sent." : result.error ?? "Send failed." });
    setSending(false);
    setConfirmOpen(false);
  }

  const RISK_META: Record<RiskLevel, { label: string; icon: typeof Shield; cls: string }> = {
    low: { label: "Low risk", icon: ShieldCheck, cls: "text-success" },
    medium: { label: "Medium risk", icon: Shield, cls: "text-warning" },
    high: { label: "High risk", icon: ShieldAlert, cls: "text-destructive" },
  };
  const meta = RISK_META[risk.level];

  return (
    <div>
      <StepHeader
        title="Test send"
        description="Review the safety score, then send a single test email to yourself. Bulk sending stays off unless you enable it in Settings."
        badge={<Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> step 9</Badge>}
      />

      {/* Safety score */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <meta.icon className={`h-5 w-5 ${meta.cls}`} /> Campaign safety score
            </CardTitle>
            <Badge variant={risk.level === "low" ? "success" : risk.level === "medium" ? "warning" : "destructive"}>
              {meta.label} · {risk.score}/100
            </Badge>
          </div>
          <CardDescription>
            {risk.canSend
              ? "No blocking issues. Review the suggestions below."
              : "Sending is blocked until the critical issues below are fixed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {risk.reasons.length === 0 && (
            <p className="text-sm text-success">No issues detected. Looks good!</p>
          )}
          {risk.reasons.map((r) => (
            <div
              key={r.id}
              className={`rounded-md border p-3 text-sm ${
                r.severity === "critical" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Badge variant={r.severity === "critical" ? "destructive" : "warning"}>{r.severity}</Badge>
                {r.message}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Fix: {r.fix}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Test send */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Send a test</CardTitle>
          <CardDescription>One email, to an address you control. Personalization uses your first contact's data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!online && (
            <Alert variant="destructive"><WifiOff className="h-4 w-4" /><AlertDescription>You're offline. Test sending needs an internet connection.</AlertDescription></Alert>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Test recipient</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!risk.canSend || !online || !testEmail.trim()}
            >
              <Send className="h-4 w-4" /> Send test email
            </Button>
          </div>
          {sendResult && (
            <div className={`flex items-center gap-2 text-sm ${sendResult.ok ? "text-success" : "text-destructive"}`}>
              {sendResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {sendResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {testSendLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Test send log</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testSendLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{l.recipient}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "success" ? "success" : "destructive"}>{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm test send</DialogTitle>
            <DialogDescription>One test email will be sent now.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-md border p-3 text-sm">
            <Row k="From name" v={campaign.fromName || smtpConfig.senderName || "—"} />
            <Row k="From email" v={campaign.fromEmail || smtpConfig.senderEmail || "—"} />
            <Row k="To" v={testEmail} />
            <Row k="Subject" v={renderedSubject || "—"} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {developerBulkEnabled && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Bulk send (advanced)</CardTitle>
            <CardDescription>
              Experimental bulk sending is enabled. It requires a successful test send and a clear safety score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setStep("bulk")}>
              <Send className="h-4 w-4" /> Open bulk send
            </Button>
          </CardContent>
        </Card>
      )}

      <StepFooter nextLabel="Export" />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
