import { useMemo, useRef, useState } from "react";
import {
  Send,
  ShieldAlert,
  ShieldCheck,
  Shield,
  ArrowLeft,
  WifiOff,
  Ban,
  Plus,
  X,
  Square,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader } from "@/components/layout/StepShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  selectBulkRecipients,
  alreadySentRecipients,
  SKIP_REASON_LABELS,
  type SkipReason,
} from "@/lib/email/bulk-send";
import { isTauri } from "@/lib/runtime";
import type { BulkRecipientResult, RiskLevel } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RunProgress {
  done: number;
  sent: number;
  failed: number;
  current: string;
}

export function BulkSendScreen() {
  const {
    campaign,
    contacts,
    importResult,
    smtpConfig,
    smtpPasswordSaved,
    online,
    developerBulkEnabled,
    suppressedEmails,
    addSuppressedEmails,
    removeSuppressedEmail,
    bulkSendLogs,
    addBulkSendLog,
    testSendLogs,
    setStep,
  } = useAppStore();

  const testSendCompleted = testSendLogs.some((l) => l.status === "success");

  const [dryRun, setDryRun] = useState(true);
  const [delayMs, setDelayMs] = useState(1000);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [suppressInput, setSuppressInput] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const stopRef = useRef(false);

  const alreadySent = useMemo(
    () => alreadySentRecipients(bulkSendLogs, campaign.id),
    [bulkSendLogs, campaign.id],
  );

  const selection = useMemo(
    () =>
      selectBulkRecipients({
        contacts,
        suppressedEmails,
        alreadySent,
      }),
    [contacts, suppressedEmails, alreadySent],
  );

  const unresolvedRequired = useMemo(() => {
    const v = validateTemplate(
      [
        campaign.subject,
        campaign.previewText,
        campaign.plainTextBody,
        campaign.htmlBody,
      ],
      contacts,
    );
    const missingNoFallback = v.variables
      .filter((x) => x.known && !x.hasFallback && x.missingCount > 0)
      .map((x) => x.path);
    return [...new Set([...v.unknownVariables, ...missingNoFallback])];
  }, [campaign, contacts]);

  const risk = useMemo(
    () =>
      assessCampaignRisk({
        campaign,
        totalContacts: selection.eligible.length,
        invalidContacts: importResult?.invalid.length ?? 0,
        smtpConfigured: !!smtpConfig.host && smtpPasswordSaved,
        testSendCompleted,
        unresolvedRequiredVariables: unresolvedRequired,
        bulkSend: true,
      }),
    [campaign, selection.eligible.length, importResult, smtpConfig, smtpPasswordSaved, unresolvedRequired, testSendCompleted],
  );

  const fromEmailForUnsub = campaign.fromEmail || smtpConfig.senderEmail || "";
  const systemVars = {
    unsubscribe_url: fromEmailForUnsub
      ? `mailto:${fromEmailForUnsub}?subject=Unsubscribe`
      : "https://example.com/unsubscribe",
  };

  const total = selection.eligible.length;
  const canRun =
    developerBulkEnabled &&
    risk.canSend &&
    testSendCompleted &&
    total > 0 &&
    (dryRun || (online && isTauri()));

  function addSuppression() {
    const emails = suppressInput
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length) addSuppressedEmails(emails);
    setSuppressInput("");
  }

  async function run() {
    setConfirmOpen(false);
    setConfirmText("");
    setRunning(true);
    setLastSummary(null);
    stopRef.current = false;
    setProgress({ done: 0, sent: 0, failed: 0, current: "" });

    const password = dryRun
      ? ""
      : (await getSecureStore().get(SECRET_KEYS.smtpPassword)) ?? "";
    const results: BulkRecipientResult[] = [];
    const startedAt = new Date().toISOString();
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < selection.eligible.length; i++) {
      if (stopRef.current) break;
      const c = selection.eligible[i];
      const to = c.normalizedEmail || c.email;
      setProgress({ done: i, sent, failed, current: to });

      const email = {
        to,
        fromName: campaign.fromName || smtpConfig.senderName,
        fromEmail: campaign.fromEmail || smtpConfig.senderEmail,
        subject: renderTemplate(campaign.subject, c, systemVars).output,
        text: renderTemplate(campaign.plainTextBody, c, systemVars).output,
        html: renderTemplate(campaign.htmlBody, c, systemVars).output,
      };

      if (dryRun) {
        results.push({ email: to, status: "sent" });
        sent += 1;
      } else {
        const r = await smtpProvider.sendOne(smtpConfig, password, email);
        if (r.ok) {
          results.push({ email: to, status: "sent" });
          sent += 1;
        } else {
          results.push({ email: to, status: "failed", error: r.error });
          failed += 1;
        }
      }

      setProgress({ done: i + 1, sent, failed, current: to });
      if (delayMs > 0 && i < selection.eligible.length - 1 && !stopRef.current) {
        await sleep(delayMs);
      }
    }

    const finishedAt = new Date().toISOString();
    addBulkSendLog({
      id: `bulk_${Date.now().toString(36)}`,
      campaignId: campaign.id,
      startedAt,
      finishedAt,
      dryRun,
      total: selection.eligible.length,
      sent,
      failed,
      skipped: selection.skipped.length,
      delayMs,
      results,
    });
    setRunning(false);
    setProgress(null);
    const stopped = stopRef.current ? " (stopped early)" : "";
    setLastSummary(
      dryRun
        ? `Dry run complete${stopped}: ${sent} message(s) would be sent, ${selection.skipped.length} skipped. Nothing was actually sent.`
        : `Send complete${stopped}: ${sent} sent, ${failed} failed, ${selection.skipped.length} skipped.`,
    );
  }

  const RISK_META: Record<RiskLevel, { label: string; icon: typeof Shield; cls: string }> = {
    low: { label: "Low risk", icon: ShieldCheck, cls: "text-success" },
    medium: { label: "Medium risk", icon: Shield, cls: "text-warning" },
    high: { label: "High risk", icon: ShieldAlert, cls: "text-destructive" },
  };
  const meta = RISK_META[risk.level];
  const latestLog = bulkSendLogs[0];

  if (!developerBulkEnabled) {
    return (
      <div>
        <StepHeader
          title="Bulk send"
          description="An advanced, opt-in feature for sending your campaign to your cleaned list."
          badge={<Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> advanced</Badge>}
        />
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <Ban className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Bulk send is disabled</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Bulk sending is off by default. For real campaigns we recommend
                exporting and using a dedicated email platform with proper
                deliverability and unsubscribe handling. To experiment here,
                enable it in Settings → Developer options.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" onClick={() => setStep("export")}>
                <ArrowLeft className="h-4 w-4" /> Back to Export
              </Button>
              <Button onClick={() => setStep("settings")}>Open Settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        title="Bulk send"
        description="Send your campaign to the eligible recipients on your cleaned list. Always do a dry run first."
        badge={<Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> advanced</Badge>}
      />

      <Alert variant="warning" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          letterflow is not a deliverability platform. Real bulk sending needs
          SPF/DKIM/DMARC and a working unsubscribe link. Sending from a personal
          SMTP account at volume can get it rate-limited or blocked. Keep volumes
          small and prefer a dedicated platform for production campaigns.
        </AlertDescription>
      </Alert>

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
            {risk.canSend && testSendCompleted
              ? "No blocking issues. Review recipients and run a dry run first."
              : "Bulk send is blocked until the critical issues below are fixed and a test send has succeeded."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!testSendCompleted && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Badge variant="destructive">critical</Badge>
                No successful test send yet.
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Fix: send one test email to yourself on the Test send step first.
              </div>
            </div>
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

      {/* Recipients */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
          <CardDescription>
            Computed from your cleaned contacts. Skipped recipients are never contacted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Stat label="Will receive" value={total} tone="success" />
            <Stat label="Skipped" value={selection.skipped.length} tone="muted" />
            <Stat label="Total contacts" value={contacts.length} tone="muted" />
          </div>
          {selection.skipped.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {(Object.entries(selection.skipCounts) as [SkipReason, number][])
                .filter(([, n]) => n > 0)
                .map(([reason, n]) => (
                  <Badge key={reason} variant="secondary" className="font-normal">
                    {SKIP_REASON_LABELS[reason]}: {n}
                  </Badge>
                ))}
            </div>
          )}
          {alreadySent.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {alreadySent.length} recipient(s) were already sent to in a previous run and are skipped automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Suppression list */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" /> Suppression list
          </CardTitle>
          <CardDescription>
            Emails here are never sent to. Paste addresses (comma, space or newline separated) to add unsubscribes or opt-outs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Textarea
              value={suppressInput}
              onChange={(e) => setSuppressInput(e.target.value)}
              placeholder="jane@example.com, john@example.com"
              className="min-h-[64px] flex-1"
            />
            <Button variant="outline" onClick={addSuppression} disabled={!suppressInput.trim()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {suppressedEmails.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {suppressedEmails.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  <span className="font-mono">{e}</span>
                  <button
                    onClick={() => removeSuppressedEmail(e)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${e}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No suppressed emails yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Send controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Send</CardTitle>
          <CardDescription>Throttle the send and always dry-run before a real send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!online && (
            <Alert variant="destructive"><WifiOff className="h-4 w-4" /><AlertDescription>You're offline. Real sending needs an internet connection.</AlertDescription></Alert>
          )}
          {!isTauri() && (
            <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertDescription>SMTP is only available in the desktop app. You can still dry-run here.</AlertDescription></Alert>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Dry run</div>
                <div className="text-xs text-muted-foreground">Render every message and report what would be sent — without sending.</div>
              </div>
            </div>
            <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={running} />
          </div>

          <div className="flex items-end gap-3">
            <div className="w-48 space-y-1.5">
              <Label>Delay between emails (ms)</Label>
              <Input
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
                disabled={running}
              />
            </div>
            <div className="flex-1 text-xs text-muted-foreground">
              ~1000 ms is a sensible default. Higher values are gentler on your SMTP provider's rate limits.
            </div>
          </div>

          {progress && (
            <div className="space-y-2">
              <Progress value={total ? (progress.done / total) * 100 : 0} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.done} / {total} · {progress.sent} sent · {progress.failed} failed</span>
                <span className="font-mono truncate max-w-[50%]">{progress.current}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="destructive" onClick={() => { stopRef.current = true; }}>
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={!canRun}>
                {dryRun ? <FlaskConical className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {dryRun ? `Dry run (${total})` : `Send to ${total} recipient(s)`}
              </Button>
            )}
            {lastSummary && !running && (
              <span className="text-sm text-muted-foreground">{lastSummary}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last run log */}
      {latestLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Last run {latestLog.dryRun && <Badge variant="secondary" className="ml-1">dry run</Badge>}
            </CardTitle>
            <CardDescription>
              {new Date(latestLog.startedAt).toLocaleString()} · {latestLog.sent} sent · {latestLog.failed} failed · {latestLog.skipped} skipped
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestLog.results.slice(0, 200).map((r, i) => (
                  <TableRow key={`${r.email}_${i}`}>
                    <TableCell className="font-mono text-xs">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "sent" ? "success" : "destructive"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <Button variant="ghost" onClick={() => setStep("export")}>
          <ArrowLeft className="h-4 w-4" /> Back to Export
        </Button>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dryRun ? "Confirm dry run" : "Confirm bulk send"}</DialogTitle>
            <DialogDescription>
              {dryRun
                ? `This renders ${total} message(s) and reports what would be sent. Nothing is actually sent.`
                : `This will send ${total} real email(s) through your SMTP account, one every ${delayMs} ms.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-md border p-3 text-sm">
            <Row k="From" v={`${campaign.fromName || smtpConfig.senderName} <${campaign.fromEmail || smtpConfig.senderEmail}>`} />
            <Row k="Subject" v={campaign.subject || "—"} />
            <Row k="Recipients" v={String(total)} />
            <Row k="Skipped" v={String(selection.skipped.length)} />
          </div>
          {!dryRun && (
            <div className="space-y-1.5">
              <Label>Type <span className="font-mono font-semibold">SEND</span> to confirm</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SEND" />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={run}
              disabled={!dryRun && confirmText.trim().toUpperCase() !== "SEND"}
            >
              {dryRun ? <FlaskConical className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {dryRun ? "Run dry run" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "muted" }) {
  return (
    <div className="rounded-md border px-4 py-2">
      <div className={`text-xl font-semibold ${tone === "success" ? "text-success" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
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
