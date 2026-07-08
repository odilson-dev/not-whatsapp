import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "emerald" | "amber" | "rose" | "sky";
}) {
  const accentClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  };

  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
          accentClasses[accent],
        )}
      >
        <Icon />
      </div>
      <div className="min-w-0">
        <div className="text-2xl leading-tight font-semibold tabular-nums">
          {value}
        </div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        {hint ? (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
