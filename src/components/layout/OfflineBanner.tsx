import { WifiOff } from "lucide-react";
import { useAppStore } from "@/app/store";

export function OfflineBanner() {
  const online = useAppStore((s) => s.online);
  if (online) return null;
  return (
    <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-6 py-2 text-sm text-destructive">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        Internet connection is required for AI generation and sending test
        emails. You can still review and edit local files offline.
      </span>
    </div>
  );
}
