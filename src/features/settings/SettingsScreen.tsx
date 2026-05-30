import { useState } from "react";
import {
  KeyRound,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getSecureStore, SECRET_KEYS } from "@/lib/ai/secure-store";
import { getAiProvider } from "@/lib/ai/generate-email";
import { smtpProvider } from "@/lib/email/providers/smtp";
import { isTauri } from "@/lib/runtime";
import { SmtpConfig } from "@/lib/email/types";

type TestState = { status: "idle" | "loading" | "ok" | "error"; message?: string };

export function SettingsScreen() {
  const {
    aiConfig,
    setAiConfig,
    aiKeySaved,
    setAiKeySaved,
    smtpConfig,
    setSmtpConfig,
    smtpPasswordSaved,
    setSmtpPasswordSaved,
    developerBulkEnabled,
    setDeveloperBulk,
    online,
  } = useAppStore();

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [smtpPassInput, setSmtpPassInput] = useState("");
  const [aiTest, setAiTest] = useState<TestState>({ status: "idle" });
  const [smtpTest, setSmtpTest] = useState<TestState>({ status: "idle" });

  async function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    await getSecureStore().set(SECRET_KEYS.aiApiKey, apiKeyInput.trim());
    setAiKeySaved(true);
    setApiKeyInput("");
  }

  async function clearApiKey() {
    await getSecureStore().delete(SECRET_KEYS.aiApiKey);
    setAiKeySaved(false);
  }

  async function testAi() {
    setAiTest({ status: "loading" });
    try {
      const key = (await getSecureStore().get(SECRET_KEYS.aiApiKey)) ?? apiKeyInput.trim();
      if (!key) throw new Error("No API key saved.");
      await getAiProvider(aiConfig.provider).testConnection(aiConfig, key);
      setAiTest({ status: "ok", message: "AI connection succeeded." });
    } catch (err) {
      setAiTest({ status: "error", message: String(err instanceof Error ? err.message : err) });
    }
  }

  async function saveSmtpPassword() {
    if (!smtpPassInput) return;
    await getSecureStore().set(SECRET_KEYS.smtpPassword, smtpPassInput);
    setSmtpPasswordSaved(true);
    setSmtpPassInput("");
  }

  async function testSmtp() {
    setSmtpTest({ status: "loading" });
    const parsed = SmtpConfig.safeParse(smtpConfig);
    if (!parsed.success) {
      setSmtpTest({ status: "error", message: "Fill in host, port and a valid sender email first." });
      return;
    }
    const password = (await getSecureStore().get(SECRET_KEYS.smtpPassword)) ?? smtpPassInput;
    const result = await smtpProvider.testConnection(parsed.data, password);
    setSmtpTest(
      result.ok
        ? { status: "ok", message: "SMTP connection succeeded." }
        : { status: "error", message: result.error ?? "Connection failed." },
    );
  }

  return (
    <div>
      <StepHeader
        title="Settings"
        description="Configure your AI provider and an email account for safe test sending. Secrets are stored in your operating system's secure credential store — never in plain text."
        badge={
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3 text-success" /> Secrets stay local
          </Badge>
        }
      />

      {!isTauri() && (
        <Alert variant="info" className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Running in the browser dev preview. Secrets are kept in memory for
            this session only (no OS keychain). In the packaged desktop app they
            are stored in the OS credential manager, and SMTP sending is enabled.
          </AlertDescription>
        </Alert>
      )}

      {/* AI provider */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> AI provider
          </CardTitle>
          <CardDescription>
            OpenAI-compatible. Works with any service exposing the same
            chat/completions API (configurable base URL and model).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Base URL">
              <Input
                value={aiConfig.baseUrl}
                onChange={(e) => setAiConfig({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
            <Field label="Model">
              <Input
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ model: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </Field>
          </div>

          <Field label="API key">
            {aiKeySaved ? (
              <div className="flex items-center gap-3">
                <Input value="••••••••••••••••" disabled className="max-w-xs font-mono" />
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Saved securely
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearApiKey}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-…"
                  className="max-w-md font-mono"
                  autoComplete="off"
                />
                <Button onClick={saveApiKey} disabled={!apiKeyInput.trim()}>
                  Save key
                </Button>
              </div>
            )}
          </Field>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={testAi} disabled={aiTest.status === "loading" || !online}>
              {aiTest.status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              Test AI connection
            </Button>
            <TestResult state={aiTest} />
          </div>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> SMTP (test sending)
          </CardTitle>
          <CardDescription>
            Used only to send a single test email to yourself. The password is
            stored securely and never displayed again after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SMTP host">
              <Input value={smtpConfig.host} onChange={(e) => setSmtpConfig({ host: e.target.value })} placeholder="smtp.example.com" />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={smtpConfig.port}
                onChange={(e) => setSmtpConfig({ port: Number(e.target.value) || 0 })}
                placeholder="587"
              />
            </Field>
            <Field label="Username">
              <Input value={smtpConfig.username} onChange={(e) => setSmtpConfig({ username: e.target.value })} placeholder="you@example.com" autoComplete="off" />
            </Field>
            <Field label="Encryption">
              <Select value={smtpConfig.encryption} onValueChange={(v) => setSmtpConfig({ encryption: v as SmtpConfig["encryption"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS (587)</SelectItem>
                  <SelectItem value="ssl_tls">SSL/TLS (465)</SelectItem>
                  <SelectItem value="none">None (not recommended)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sender email">
              <Input value={smtpConfig.senderEmail} onChange={(e) => setSmtpConfig({ senderEmail: e.target.value })} placeholder="campaigns@example.com" />
            </Field>
            <Field label="Sender name">
              <Input value={smtpConfig.senderName} onChange={(e) => setSmtpConfig({ senderName: e.target.value })} placeholder="Your Organisation" />
            </Field>
          </div>

          <Field label="SMTP password">
            {smtpPasswordSaved ? (
              <div className="flex items-center gap-3">
                <Input value="••••••••••••" disabled className="max-w-xs font-mono" />
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Saved securely
                </Badge>
                <Button variant="ghost" size="sm" onClick={async () => { await getSecureStore().delete(SECRET_KEYS.smtpPassword); setSmtpPasswordSaved(false); }}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input type="password" value={smtpPassInput} onChange={(e) => setSmtpPassInput(e.target.value)} placeholder="••••••••" className="max-w-md font-mono" autoComplete="off" />
                <Button onClick={saveSmtpPassword} disabled={!smtpPassInput}>Save password</Button>
              </div>
            )}
          </Field>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={testSmtp} disabled={smtpTest.status === "loading" || !online}>
              {smtpTest.status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              Send connection test
            </Button>
            <TestResult state={smtpTest} />
          </div>
        </CardContent>
      </Card>

      {/* Developer */}
      <Card>
        <CardHeader>
          <CardTitle>Developer options</CardTitle>
          <CardDescription>
            Bulk production sending is intentionally disabled in the MVP. Leave
            this off unless you understand the deliverability implications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Enable experimental bulk send</div>
              <div className="text-xs text-muted-foreground">
                Even when enabled, bulk send requires a completed test and a low risk score.
              </div>
            </div>
            <Switch checked={developerBulkEnabled} onCheckedChange={setDeveloperBulk} />
          </div>
        </CardContent>
      </Card>

      <StepFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (state.status === "ok")
    return (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> {state.message}
      </span>
    );
  if (state.status === "error")
    return (
      <span className="flex items-center gap-1.5 text-sm text-destructive">
        <XCircle className="h-4 w-4" /> {state.message}
      </span>
    );
  return null;
}
