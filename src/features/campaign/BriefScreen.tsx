import { useMemo } from "react";
import { FileText, ShieldCheck, Eye } from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { collectFieldNames, collectContextText } from "@/features/campaign/derive";

const EXAMPLE =
  "Write a warm email to people who attended last year's event and invite them again this year. It should sound friendly and not corporate. Mention dogs, registration deadline, website, and that they can unsubscribe.";

export function BriefScreen() {
  const campaign = useAppStore((s) => s.campaign);
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const files = useAppStore((s) => s.files);
  const contacts = useAppStore((s) => s.contacts);
  const aiIncludeSamples = useAppStore((s) => s.aiIncludeSamples);
  const setAiIncludeSamples = useAppStore((s) => s.setAiIncludeSamples);

  const fieldNames = useMemo(() => collectFieldNames(contacts), [contacts]);
  const contextText = useMemo(() => collectContextText(files), [files]);

  return (
    <div>
      <StepHeader
        title="Campaign brief"
        description="Describe the email in your own words — it can be rough and incomplete. We'll combine it with your uploaded notes."
        badge={<Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> step 5</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Campaign name</Label>
            <Input value={campaign.name} onChange={(e) => updateCampaign({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Your brief</Label>
            <Textarea
              value={campaign.brief}
              onChange={(e) => updateCampaign({ brief: e.target.value })}
              placeholder={EXAMPLE}
              className="min-h-[220px]"
            />
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => updateCampaign({ brief: EXAMPLE })}
            >
              Use example brief
            </button>
          </div>

          {contextText && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Context from your files</CardTitle>
                <CardDescription>This text will be combined with your brief.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs text-muted-foreground scrollbar-thin">
                  {contextText.slice(0, 1200)}
                  {contextText.length > 1200 ? "…" : ""}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-success" /> What gets sent to AI
              </CardTitle>
              <CardDescription>Data minimization — review before generating.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SentRow label="Campaign brief" included />
              <SentRow label="Context text from files" included={!!contextText} />
              <SentRow label="Field names (no values)" included detail={fieldNames.join(", ") || "none"} />
              <SentRow
                label="Full contact list"
                included={false}
                detail="Never sent"
              />

              <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Eye className="h-3.5 w-3.5" /> Include anonymized samples
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A few rows with <b>masked</b> values (e.g. xxxx@example.com) to
                    help structure. Opt-in.
                  </p>
                </div>
                <Switch checked={aiIncludeSamples} onCheckedChange={setAiIncludeSamples} />
              </div>

              <Alert variant="info">
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Real names, emails and custom values are never sent unless you
                  explicitly opt in — and even then they are masked.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>

      <StepFooter nextLabel="Generate email" nextDisabled={!campaign.brief.trim()} />
    </div>
  );
}

function SentRow({ label, included, detail }: { label: string; included: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {detail && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
      </div>
      <Badge variant={included ? "success" : "secondary"}>{included ? "sent" : "not sent"}</Badge>
    </div>
  );
}
