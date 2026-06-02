import { useMemo, useState } from "react";
import { Eye, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { buildPreviewSamples } from "@/lib/preview/sample";
import { renderTemplate } from "@/lib/templates/render-template";

export function PreviewScreen() {
  const { campaign, contacts, smtpConfig } = useAppStore();
  const samples = useMemo(() => buildPreviewSamples(contacts), [contacts]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fromEmailForUnsub = campaign.fromEmail || smtpConfig.senderEmail || "";
  const systemVars = {
    unsubscribe_url: fromEmailForUnsub
      ? `mailto:${fromEmailForUnsub}?subject=Unsubscribe`
      : "https://example.com/unsubscribe",
  };

  const active = samples.find((s) => s.contact.id === activeId) ?? samples[0];

  if (!active) {
    return (
      <div>
        <StepHeader title="Preview" />
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No contacts to preview. Import contacts first.</AlertDescription>
        </Alert>
        <StepFooter />
      </div>
    );
  }

  const subject = renderTemplate(campaign.subject, active.contact, systemVars);
  const plain = renderTemplate(campaign.plainTextBody, active.contact, systemVars);
  const html = renderTemplate(campaign.htmlBody, active.contact, systemVars);
  const allUnresolved = [...new Set([...subject.unresolved, ...plain.unresolved, ...html.unresolved])];
  const allFallback = [...new Set([...subject.usedFallback, ...plain.usedFallback, ...html.usedFallback])];

  return (
    <div>
      <StepHeader
        title="Preview"
        description="See the email as different real contacts will receive it — not just the first row. Unresolved variables and fallbacks are highlighted."
        badge={<Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> step 8</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground">Smart samples</div>
          {samples.map((s) => (
            <button
              key={s.contact.id}
              onClick={() => setActiveId(s.contact.id)}
              className={cn(
                "w-full rounded-md border p-3 text-left text-sm transition-colors",
                active.contact.id === s.contact.id ? "border-primary bg-primary/10" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">{s.label}</div>
              <div className="truncate text-xs text-muted-foreground">{s.contact.email}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{s.reason}</div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {(allUnresolved.length > 0 || allFallback.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {allUnresolved.map((u) => (
                <Badge key={u} variant="destructive">unresolved: {u}</Badge>
              ))}
              {allFallback.map((u) => (
                <Badge key={u} variant="warning">fallback: {u}</Badge>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="text-xs text-muted-foreground">Subject</div>
              <CardTitle className="text-base">
                <Highlighted text={subject.output} unresolved={subject.unresolved} />
              </CardTitle>
              {campaign.previewText && (
                <div className="text-xs text-muted-foreground">
                  Preview: {renderTemplate(campaign.previewText, active.contact, systemVars).output}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-xs text-muted-foreground">
                To: <span className="font-mono">{active.contact.email}</span> · From: {campaign.fromName || "—"} &lt;{campaign.fromEmail || "—"}&gt;
              </div>
              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="plain">Plain text</TabsTrigger>
                </TabsList>
                <TabsContent value="html">
                  <div className="rounded border bg-white p-4 text-sm text-black" dangerouslySetInnerHTML={{ __html: html.output }} />
                </TabsContent>
                <TabsContent value="plain">
                  <pre className="whitespace-pre-wrap rounded bg-muted/50 p-4 text-sm scrollbar-thin">{plain.output}</pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <StepFooter nextLabel="Test send" />
    </div>
  );
}

/** Render text with {{ unresolved }} markers visually emphasized. */
function Highlighted({ text, unresolved }: { text: string; unresolved: string[] }) {
  if (unresolved.length === 0) return <>{text}</>;
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{.*\}\}$/.test(p) ? (
          <span key={i} className="rounded bg-destructive/20 px-1 text-destructive">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
