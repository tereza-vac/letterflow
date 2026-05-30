import { useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Trash2,
  Users,
  AlignLeft,
  HelpCircle,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { StepHeader, StepFooter } from "@/components/layout/StepShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { effectiveFileType, type DetectedFileType, type UploadedFile } from "@/lib/types";
import { processFile, isSupported } from "@/features/upload/process-file";

export function UploadScreen() {
  const files = useAppStore((s) => s.files);
  const addFiles = useAppStore((s) => s.addFiles);
  const removeFile = useAppStore((s) => s.removeFile);
  const updateFile = useAppStore((s) => s.updateFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | File[]) {
    setError(null);
    const arr = Array.from(fileList);
    const unsupported = arr.filter((f) => !isSupported(f.name));
    if (unsupported.length) {
      setError(`Unsupported file(s) skipped: ${unsupported.map((f) => f.name).join(", ")}`);
    }
    const supported = arr.filter((f) => isSupported(f.name));
    const processed = await Promise.all(supported.map(processFile));
    if (processed.length) addFiles(processed);
  }

  const contactFiles = files.filter((f) => effectiveFileType(f) === "contacts");

  return (
    <div>
      <StepHeader
        title="Upload files"
        description="Add your spreadsheets and notes. letterflow guesses which files contain contacts and which are campaign context — you can override any guess."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
        <div className="font-medium">Drag &amp; drop files here, or click to browse</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Supported: .xlsx · .csv · .md · .txt
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.csv,.md,.txt"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onRemove={() => removeFile(f.id)}
              onOverride={(t) => updateFile(f.id, { overrideType: t })}
            />
          ))}
        </div>
      )}

      <StepFooter
        nextLabel={contactFiles.length ? "Map contacts" : "Continue"}
      />
    </div>
  );
}

const TYPE_META: Record<DetectedFileType, { label: string; icon: typeof Users; variant: "default" | "secondary" | "outline" }> = {
  contacts: { label: "Contact source", icon: Users, variant: "default" },
  context: { label: "Campaign context", icon: AlignLeft, variant: "secondary" },
  unknown: { label: "Unknown", icon: HelpCircle, variant: "outline" },
};

function FileRow({
  file,
  onRemove,
  onOverride,
}: {
  file: UploadedFile;
  onRemove: () => void;
  onOverride: (t: DetectedFileType) => void;
}) {
  const type = effectiveFileType(file);
  const meta = TYPE_META[type];
  const Icon = file.extension === "xlsx" || file.extension === "csv" ? FileSpreadsheet : FileText;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{file.name}</span>
            <Badge variant={meta.variant} className="gap-1">
              <meta.icon className="h-3 w-3" /> {meta.label}
            </Badge>
            {file.overrideType && (
              <Badge variant="outline" className="text-[10px]">overridden</Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {file.table
              ? `${file.table.rows.length} rows · ${file.table.headers.length} columns`
              : file.contextText
                ? `${file.contextText.length} characters of context`
                : "empty"}
          </div>
          {file.contextText && (
            <p className="mt-2 line-clamp-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
              {file.contextText.slice(0, 240)}
            </p>
          )}
        </div>
        <Select value={type} onValueChange={(v) => onOverride(v as DetectedFileType)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contacts">Contact source</SelectItem>
            <SelectItem value="context">Campaign context</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
