import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Full-page loading state shared by auth gates and redirect screens.
 * Inline button/form spinners stay local; this is for moments where the
 * current screen is not ready to be shown.
 */
export function AppLoader({ label, className, size = 28 }: { label?: string; className?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className={cn("grid min-h-screen place-items-center", className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-muted-foreground" size={size} />
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : <span className="sr-only">Loading…</span>}
      </div>
    </div>
  );
}
