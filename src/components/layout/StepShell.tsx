import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore, STEP_ORDER, type Step } from "@/app/store";

export function StepHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export function StepFooter({
  nextLabel = "Continue",
  nextDisabled = false,
  onNext,
  hideBack = false,
}: {
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  hideBack?: boolean;
}) {
  const step = useAppStore((s) => s.step);
  const setStep = useAppStore((s) => s.setStep);
  const idx = STEP_ORDER.indexOf(step);
  const prev = STEP_ORDER[idx - 1] as Step | undefined;
  const next = STEP_ORDER[idx + 1] as Step | undefined;

  return (
    <div className="mt-8 flex items-center justify-between border-t pt-5">
      <div>
        {!hideBack && prev && (
          <Button variant="ghost" onClick={() => setStep(prev)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>
      {next && (
        <Button
          disabled={nextDisabled}
          onClick={() => {
            onNext?.();
            setStep(next);
          }}
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
