import { useState } from "react";
import {
  Sparkles,
  Loader2,
  WifiOff,
  KeyRound,
  AlertTriangle,
  Check,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSecureStore, SECRET_KEYS } from "@/lib/ai/secure-store";
import { buildAiPayload, generateEmail } from "@/lib/ai/generate-email";
import { collectFieldNames, collectContextText } from "@/features/campaign/derive";
import type { GeneratedEmail } from "@/lib/ai/types";

export function GenerateScreen() {
  const { campaign, updateCampaign, files, contacts, aiConfig, aiKeySaved, aiIncludeSamples, online, setStep } =
    useAppStore();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedEmail | null>(null);

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const apiKey = await getSecureStore().get(SECRET_KEYS.aiApiKey);
      if (!apiKey) throw new Error("No AI API key saved. Add one in Settings.");

      const payload = buildAiPayload({
        brief: campaign.brief,
        contextText: collectContextText(files),
        fieldNames: collectFieldNames(contacts),
        contacts,
        includeAnonymizedSamples: aiIncludeSamples,
      });

      const generated = await generateEmail({ config: aiConfig, apiKey, payload });
      setResult(generated);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function applyToCampaign(subject: string) {
    if (!result) return;
    const plain = `${result.plainTextBody}\n\n${result.footer}`.trim();
    updateCampaign({
      subject,
      previewText: result.previewText,
      plainTextBody: plain,
      htmlBody: result.htmlBody.includes(result.footer)
        ? result.htmlBody
        : `${result.htmlBody}\n<hr/>\n<p style="font-size:12px;color:#888">${result.footer}</p>`,
      status: "ready",
    });
    setStep("edit");
  }

  const blocked = !online || !aiKeySaved;

  return (
    <div>
      <StepHeader
        title="Generate email"
        description="The AI drafts subject options, a plain-text and HTML body, a footer, and flags any missing information."
        badge={<Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> step 6</Badge>}
      />

      {!online && (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Offline</AlertTitle>
          <AlertDescription>AI generation needs an internet connection.</AlertDescription>
        </Alert>
      )}
      {!aiKeySaved && (
        <Alert variant="warning" className="mb-4">
          <KeyRound className="h-4 w-4" />
          <AlertDescription>
            No AI API key saved. <button className="underline" onClick={() => setStep("settings")}>Open Settings</button> to add one.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <div className="font-medium">Ready to draft from your brief</div>
            <div className="text-sm text-muted-foreground">
              Using model <span className="font-mono">{aiConfig.model}</span> · no personal data is sent{aiIncludeSamples ? " (masked samples included)" : ""}.
            </div>
          </div>
          <Button size="lg" onClick={generate} disabled={blocked || status === "loading"}>
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {status === "loading" ? "Generating…" : result ? "Regenerate" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      {status === "error" && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject options</CardTitle>
              <CardDescription>Pick one to apply, or edit later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.subjectOptions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    {s === result.recommendedSubject && <Badge variant="success">recommended</Badge>}
                    <span>{s}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => applyToCampaign(s)}>
                    <Check className="h-3.5 w-3.5" /> Use &amp; edit
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Plain text</CardTitle></CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs scrollbar-thin">{result.plainTextBody}</pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">HTML preview</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-auto rounded border bg-white p-3 text-xs text-black scrollbar-thin" dangerouslySetInnerHTML={{ __html: result.htmlBody }} />
              </CardContent>
            </Card>
          </div>

          {result.missingInfoWarnings.length > 0 && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Missing information</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc space-y-0.5">
                  {result.missingInfoWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {result.toneNotes.length > 0 && (
              <NoteCard icon={<MessageSquare className="h-4 w-4" />} title="Tone notes" items={result.toneNotes} />
            )}
            {result.personalizationSuggestions.length > 0 && (
              <NoteCard icon={<Lightbulb className="h-4 w-4" />} title="Personalization ideas" items={result.personalizationSuggestions} />
            )}
          </div>
        </div>
      )}

      <StepFooter nextLabel="Edit email" nextDisabled={!result && campaign.status === "draft"} />
    </div>
  );
}

function NoteCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((t, i) => <li key={i}>• {t}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
