import { useEffect, useMemo, useRef } from "react";
import { PencilLine, Variable, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { collectFieldNames } from "@/features/campaign/derive";
import { validateTemplate } from "@/lib/templates/validate-template";

type FieldRef = HTMLInputElement | HTMLTextAreaElement | null;

export function EditScreen() {
  const { campaign, updateCampaign, contacts, smtpConfig } = useAppStore();
  const lastFocused = useRef<FieldRef>(null);

  useEffect(() => {
    if (!campaign.fromEmail && smtpConfig.senderEmail) {
      updateCampaign({ fromEmail: smtpConfig.senderEmail, fromName: smtpConfig.senderName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldNames = useMemo(() => collectFieldNames(contacts), [contacts]);
  const variables = useMemo(
    () => [
      ...fieldNames.map((f) => `{{ ${f} }}`),
      '{{ firstName | default: "there" }}',
      "{{ unsubscribe_url }}",
    ],
    [fieldNames],
  );

  const validation = useMemo(
    () =>
      validateTemplate(
        [campaign.subject, campaign.previewText, campaign.plainTextBody, campaign.htmlBody],
        contacts,
      ),
    [campaign.subject, campaign.previewText, campaign.plainTextBody, campaign.htmlBody, contacts],
  );

  function insertVariable(token: string) {
    const el = lastFocused.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    const name = el.dataset.field as "subject" | "previewText" | "plainTextBody" | "htmlBody";
    updateCampaign({ [name]: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div>
      <StepHeader
        title="Edit email"
        description="Fine-tune the copy and personalization. Insert variables from the sidebar; unresolved variables are flagged."
        badge={<Badge variant="outline" className="gap-1"><PencilLine className="h-3 w-3" /> step 7</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From name</Label>
              <Input value={campaign.fromName} onChange={(e) => updateCampaign({ fromName: e.target.value })} placeholder="Your Organisation" />
            </div>
            <div className="space-y-1.5">
              <Label>From email</Label>
              <Input value={campaign.fromEmail} onChange={(e) => updateCampaign({ fromEmail: e.target.value })} placeholder="campaigns@example.com" />
            </div>
          </div>

          <EditField label="Subject" field="subject" value={campaign.subject} onChange={(v) => updateCampaign({ subject: v })} lastFocused={lastFocused} single />
          <EditField label="Preview text" field="previewText" value={campaign.previewText} onChange={(v) => updateCampaign({ previewText: v })} lastFocused={lastFocused} single />
          <EditField label="Plain text body" field="plainTextBody" value={campaign.plainTextBody} onChange={(v) => updateCampaign({ plainTextBody: v })} lastFocused={lastFocused} rows={12} />
          <EditField label="HTML body" field="htmlBody" value={campaign.htmlBody} onChange={(v) => updateCampaign({ htmlBody: v })} lastFocused={lastFocused} rows={10} mono />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Variable className="h-4 w-4" /> Variables</CardTitle>
              <CardDescription>Click to insert at your cursor.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button key={v} onClick={() => insertVariable(v)} className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] hover:bg-accent">
                  {v}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Variable analysis</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {validation.variables.length === 0 && (
                <p className="text-xs text-muted-foreground">No variables used yet.</p>
              )}
              {validation.variables.map((v) => (
                <div key={v.path} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{v.path}</span>
                    {v.known ? (
                      <Badge variant={v.missingCount > 0 ? "warning" : "secondary"}>{v.missingCount > 0 ? `${v.missingCount} missing` : "ok"}</Badge>
                    ) : (
                      <Badge variant="destructive">unknown</Badge>
                    )}
                  </div>
                  {v.missingCount > 0 && (
                    <p className="mt-0.5 text-muted-foreground">
                      Missing for {v.missingCount} of {contacts.length} contacts{v.hasFallback ? " (fallback set)" : ""}.
                    </p>
                  )}
                </div>
              ))}
              {validation.unknownVariables.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Unknown variables: {validation.unknownVariables.join(", ")}. These won't resolve for anyone.
                  </AlertDescription>
                </Alert>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => insertVariable("\n\nYou can unsubscribe at any time: {{ unsubscribe_url }}")}>
                Add unsubscribe line
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <StepFooter nextLabel="Preview" />
    </div>
  );
}

function EditField({
  label,
  field,
  value,
  onChange,
  lastFocused,
  rows,
  single,
  mono,
}: {
  label: string;
  field: string;
  value: string;
  onChange: (v: string) => void;
  lastFocused: React.MutableRefObject<FieldRef>;
  rows?: number;
  single?: boolean;
  mono?: boolean;
}) {
  const common = {
    value,
    "data-field": field,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      lastFocused.current = e.target;
    },
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {single ? (
        <Input {...common} />
      ) : (
        <Textarea {...common} rows={rows} className={mono ? "font-mono text-xs" : ""} />
      )}
    </div>
  );
}
