import { useEffect, useMemo } from "react";
import { Columns3, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  detectColumns,
  HIGH_CONFIDENCE,
  slugifyHeader,
} from "@/lib/imports/detect-columns";
import { effectiveFileType, type CanonicalField, type ColumnMapping, type UploadedFile } from "@/lib/types";

const FIELD_LABELS: Record<CanonicalField, string> = {
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  company: "Company",
  phone: "Phone",
  city: "City",
  note: "Note",
  custom: "Custom field",
  ignore: "Ignore column",
};

export function MapScreen() {
  const files = useAppStore((s) => s.files);
  const mappings = useAppStore((s) => s.mappings);
  const setMappings = useAppStore((s) => s.setMappings);

  const contactFiles = useMemo(
    () => files.filter((f) => effectiveFileType(f) === "contacts" && f.table),
    [files],
  );

  // Seed mappings from detection for files that don't have one yet.
  useEffect(() => {
    for (const f of contactFiles) {
      if (mappings[f.id] || !f.table) continue;
      const detections = detectColumns(f.table);
      const seeded: ColumnMapping[] = detections.map((d) => ({
        header: d.header,
        field: d.confidence >= HIGH_CONFIDENCE ? d.suggestedField : d.suggestedField,
        customKey: d.suggestedCustomKey,
      }));
      setMappings(f.id, seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactFiles.length]);

  if (contactFiles.length === 0) {
    return (
      <div>
        <StepHeader title="Map contacts" />
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No contact files yet. Go back to Upload and add a CSV or XLSX with an
            email column.
          </AlertDescription>
        </Alert>
        <StepFooter />
      </div>
    );
  }

  const hasEmailMapped = contactFiles.every((f) =>
    (mappings[f.id] ?? []).some((m) => m.field === "email"),
  );

  return (
    <div>
      <StepHeader
        title="Map contacts"
        description="Confirm how each column maps to a contact field. High-confidence guesses are preselected; low-confidence ones are worth a check. Unmapped columns are kept as custom fields."
        badge={<Badge variant="outline" className="gap-1"><Columns3 className="h-3 w-3" /> {contactFiles.length} file(s)</Badge>}
      />

      {!hasEmailMapped && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Every contact file needs exactly one column mapped to <b>Email</b>.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {contactFiles.map((f) => (
          <FileMapping key={f.id} file={f} />
        ))}
      </div>

      <StepFooter nextLabel="Clean contacts" nextDisabled={!hasEmailMapped} />
    </div>
  );
}

function FileMapping({ file }: { file: UploadedFile }) {
  const mappings = useAppStore((s) => s.mappings[file.id] ?? []);
  const setMappings = useAppStore((s) => s.setMappings);
  const detections = useMemo(() => (file.table ? detectColumns(file.table) : []), [file]);

  const update = (header: string, patch: Partial<ColumnMapping>) => {
    const next = mappings.map((m) => (m.header === header ? { ...m, ...patch } : m));
    setMappings(file.id, next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{file.name}</CardTitle>
        <CardDescription>
          {file.table?.rows.length} rows · {file.table?.headers.length} columns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {detections.map((d) => {
          const mapping = mappings.find((m) => m.header === d.header);
          const field = mapping?.field ?? d.suggestedField;
          const low = d.confidence < HIGH_CONFIDENCE;
          return (
            <div key={d.header} className="grid grid-cols-12 items-start gap-3 rounded-md border p-3">
              <div className="col-span-3">
                <div className="truncate font-medium">{d.header}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  e.g. {d.sampleValues.slice(0, 2).join(", ") || "—"}
                </div>
              </div>

              <div className="col-span-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className={low ? "text-warning" : "text-success"}>
                    {Math.round(d.confidence * 100)}%
                  </span>
                </div>
                <Progress
                  value={Math.round(d.confidence * 100)}
                  indicatorClassName={low ? "bg-warning" : "bg-success"}
                />
                <ul className="mt-1.5 space-y-0.5">
                  {d.reasons.slice(0, 2).map((r, i) => (
                    <li key={i} className="text-[11px] leading-tight text-muted-foreground">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-4">
                <Select value={field} onValueChange={(v) => update(d.header, { field: v as CanonicalField })}>
                  <SelectTrigger className={low && field !== "ignore" ? "border-warning/60" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                {field === "custom" && (
                  <Input
                    value={mapping?.customKey ?? slugifyHeader(d.header)}
                    onChange={(e) => update(d.header, { customKey: e.target.value })}
                    placeholder="fieldKey"
                    className="text-xs"
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
