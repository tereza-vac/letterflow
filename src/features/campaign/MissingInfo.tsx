import { AlertTriangle } from "lucide-react";

/**
 * High-contrast checklist of facts the AI flagged as missing. Replaces the old
 * low-contrast amber alert, which was hard to read on the dark theme.
 */
export function MissingInfo({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 flex-none" />
        <h3 className="text-sm font-semibold">Missing information</h3>
        <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
          {items.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/70">
        The AI left placeholders for details it couldn't find. Fill these in before sending.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
