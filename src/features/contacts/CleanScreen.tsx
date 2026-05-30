import { useMemo } from "react";
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  Copy,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { runImport } from "@/features/contacts/run-import";
import { buildQualityReport } from "@/lib/contacts/quality-report";
import { formatPercent } from "@/lib/utils";
import type { Contact } from "@/lib/types";

export function CleanScreen() {
  const files = useAppStore((s) => s.files);
  const mappings = useAppStore((s) => s.mappings);
  const importResult = useAppStore((s) => s.importResult);
  const setImportResult = useAppStore((s) => s.setImportResult);

  function recompute() {
    setImportResult(runImport(files, mappings));
  }

  // Auto-run on first visit if we have mappings but no result yet.
  if (!importResult && Object.keys(mappings).length > 0) {
    queueMicrotask(recompute);
  }

  const quality = useMemo(
    () =>
      importResult
        ? buildQualityReport(
            importResult.contacts,
            importResult.invalid.length,
            importResult.summary.exactDuplicatesRemoved,
          )
        : null,
    [importResult],
  );

  if (!importResult) {
    return (
      <div>
        <StepHeader title="Clean contacts" />
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No import yet. Map at least one contact file (with an email column)
            first, then return here.
          </AlertDescription>
        </Alert>
        <StepFooter />
      </div>
    );
  }

  const s = importResult.summary;

  return (
    <div>
      <StepHeader
        title="Clean contacts"
        description="Emails are normalized, validated and deduplicated. Nothing is deleted — invalid and review items are kept in their own tabs."
        badge={<Badge variant="outline" className="gap-1"><ListChecks className="h-3 w-3" /> import report</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows imported" value={s.totalRows} />
        <Stat label="Valid contacts" value={s.validContacts} tone="success" />
        <Stat label="Invalid emails" value={s.invalidEmails + s.missingEmails} tone={s.invalidEmails + s.missingEmails ? "destructive" : undefined} />
        <Stat label="Exact duplicates removed" value={s.exactDuplicatesRemoved} />
        <Stat label="Near-duplicates to review" value={s.nearDuplicatesForReview} tone={s.nearDuplicatesForReview ? "warning" : undefined} />
        <Stat label="Missing required fields" value={s.missingRequiredFields} />
        <Stat label="Custom fields" value={s.customFieldsDetected.length} />
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={recompute} className="w-full">
            <RefreshCw className="h-3.5 w-3.5" /> Re-run
          </Button>
        </div>
      </div>

      <Tabs defaultValue="valid">
        <TabsList>
          <TabsTrigger value="valid">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Valid ({importResult.contacts.length})
          </TabsTrigger>
          <TabsTrigger value="review">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Needs review ({importResult.needsReview.length})
          </TabsTrigger>
          <TabsTrigger value="invalid">
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Invalid ({importResult.invalid.length})
          </TabsTrigger>
          <TabsTrigger value="quality">Data quality</TabsTrigger>
        </TabsList>

        <TabsContent value="valid">
          <ContactTable contacts={importResult.contacts.slice(0, 200)} total={importResult.contacts.length} />
        </TabsContent>

        <TabsContent value="review">
          {importResult.needsReview.length === 0 ? (
            <EmptyNote text="No near-duplicates detected. Similar names are never merged automatically." />
          ) : (
            <Card>
              <CardContent className="space-y-2 p-4">
                {importResult.needsReview.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invalid">
          {importResult.invalid.length === 0 ? (
            <EmptyNote text="No invalid contacts. " />
          ) : (
            <ContactTable contacts={importResult.invalid.slice(0, 200)} total={importResult.invalid.length} />
          )}
        </TabsContent>

        <TabsContent value="quality">
          {quality && <QualityPanel quality={quality} />}
        </TabsContent>
      </Tabs>

      <StepFooter nextLabel="Write campaign brief" nextDisabled={importResult.contacts.length === 0} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function ContactTable({ contacts, total }: { contacts: Contact[]; total: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              <TableHead>Custom fields</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.email}</TableCell>
                <TableCell>{c.firstName ?? "—"}</TableCell>
                <TableCell>{c.lastName ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {Object.entries(c.customFields)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`)
                    .join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === "active" ? "success" : "destructive"}>{c.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > contacts.length && (
          <div className="border-t p-2 text-center text-xs text-muted-foreground">
            Showing first {contacts.length} of {total}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QualityPanel({ quality }: { quality: ReturnType<typeof buildQualityReport> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Invalid email rate</div><div className="text-xl font-semibold">{formatPercent(quality.invalidEmailRate, 1)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Duplicate rate</div><div className="text-xl font-semibold">{formatPercent(quality.duplicateRate, 1)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Suspicious rows</div><div className="text-xl font-semibold">{quality.suspiciousRows}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-field quality</CardTitle>
          <CardDescription>Missing values, long values, and diacritics/special characters per field.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Missing</TableHead>
                <TableHead>Long values</TableHead>
                <TableHead>Diacritics</TableHead>
                <TableHead>Special chars</TableHead>
                <TableHead>Format</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quality.fields.map((f) => (
                <TableRow key={f.field}>
                  <TableCell className="font-medium">{f.field}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.round(f.missingRate * 100)} className="w-16" indicatorClassName={f.missingRate > 0.5 ? "bg-warning" : "bg-primary"} />
                      <span className="text-xs text-muted-foreground">{f.missing}</span>
                    </div>
                  </TableCell>
                  <TableCell>{f.longValues || "—"}</TableCell>
                  <TableCell>{f.withDiacritics || "—"}</TableCell>
                  <TableCell>{f.withSpecialChars || "—"}</TableCell>
                  <TableCell>{f.inconsistentFormat ? <Badge variant="warning">inconsistent</Badge> : <Badge variant="secondary">ok</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
