import { useAppStore, STEP_ORDER, type Step } from "@/app/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Wifi,
  WifiOff,
  Settings,
  Upload,
  Columns3,
  Sparkles,
  PencilLine,
  Eye,
  Send,
  Download,
  Home,
  ListChecks,
  FileText,
} from "lucide-react";

const STEP_META: Record<Step, { label: string; icon: typeof Home; n?: number }> = {
  welcome: { label: "Welcome", icon: Home },
  settings: { label: "Settings", icon: Settings, n: 1 },
  upload: { label: "Upload files", icon: Upload, n: 2 },
  map: { label: "Map contacts", icon: Columns3, n: 3 },
  clean: { label: "Clean contacts", icon: ListChecks, n: 4 },
  brief: { label: "Campaign brief", icon: FileText, n: 5 },
  generate: { label: "Generate", icon: Sparkles, n: 6 },
  edit: { label: "Edit email", icon: PencilLine, n: 7 },
  preview: { label: "Preview", icon: Eye, n: 8 },
  test: { label: "Test send", icon: Send, n: 9 },
  export: { label: "Export", icon: Download, n: 10 },
};

export function Sidebar() {
  const step = useAppStore((s) => s.step);
  const setStep = useAppStore((s) => s.setStep);
  const online = useAppStore((s) => s.online);
  const contacts = useAppStore((s) => s.contacts);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card/40">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Send className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">letterflow</div>
          <div className="text-[11px] text-muted-foreground">
            local campaign builder
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-3 py-2">
        {STEP_ORDER.map((s) => {
          const meta = STEP_META[s];
          const Icon = meta.icon;
          const active = step === s;
          return (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{meta.label}</span>
              {meta.n && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    active ? "text-primary" : "text-muted-foreground/60",
                  )}
                >
                  {meta.n}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-2 border-t p-3">
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>Contacts loaded</span>
          <Badge variant="secondary">{contacts.length}</Badge>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
            online ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Online" : "Offline"}
        </div>
      </div>
    </aside>
  );
}
