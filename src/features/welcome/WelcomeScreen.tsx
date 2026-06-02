import {
  Wifi,
  WifiOff,
  ShieldCheck,
  FileSpreadsheet,
  Sparkles,
  Send,
  FlaskConical,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadTestData } from "@/lib/dev/seed";

export function WelcomeScreen() {
  const online = useAppStore((s) => s.online);
  const setStep = useAppStore((s) => s.setStep);

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Local-first · your data stays on this device
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Turn messy files into a clean email campaign
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          letterflow imports your spreadsheets and notes, cleans and validates
          contacts, helps you draft a warm email with AI, previews
          personalization, and sends a safe test — all on your computer. Export
          everything when you're ready to send through a professional platform.
        </p>
      </div>

      {online ? (
        <Alert variant="success" className="mb-6">
          <Wifi className="h-4 w-4" />
          <AlertTitle>You're online</AlertTitle>
          <AlertDescription>
            AI generation and test sending are available.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="mb-6">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Internet connection required for AI &amp; sending</AlertTitle>
          <AlertDescription>
            Internet connection is required for AI generation and sending test
            emails. You can continue in offline mode to review and edit local
            files; AI generation and test sending are disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<FileSpreadsheet className="h-5 w-5 text-primary" />}
          title="Import & clean"
          body="XLSX, CSV, Markdown and TXT. Smart column detection, validation, dedupe and a transparent quality report."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          title="Draft with AI"
          body="Write a rough brief; get subjects, plain-text + HTML, a footer, and missing-info warnings — no personal data sent by default."
        />
        <FeatureCard
          icon={<Send className="h-5 w-5 text-primary" />}
          title="Preview & test"
          body="Smart preview across real contacts, a safety score, and a single guarded test send through your own SMTP."
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" onClick={() => setStep("settings")}>
          Get started
        </Button>
        <Button size="lg" variant="outline" onClick={() => setStep("upload")}>
          Skip to uploading files
        </Button>
        {import.meta.env.DEV && (
          <Button
            size="lg"
            variant="ghost"
            className="ml-auto gap-1.5 text-muted-foreground"
            onClick={loadTestData}
          >
            <FlaskConical className="h-4 w-4" /> Load test data (dev)
          </Button>
        )}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="mb-1 font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
