"use client";

import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// Avoids a hydration mismatch: next-themes only knows the real theme on the
// client, so we render a stable placeholder until mounted. useSyncExternalStore
// returns the server snapshot (false) during SSR/hydration and the client
// snapshot (true) afterwards, without a state-in-effect.
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

// Compact icon button that flips between light and dark. Pass `bare` to drop
// the default chrome and style it entirely via `className` (e.g. to match a
// surrounding icon-button group).
export function ThemeToggle({
  className,
  bare = false,
}: {
  className?: string;
  bare?: boolean;
}) {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        bare
          ? "[&_svg]:size-5"
          : "flex size-9 items-center cursor-pointer justify-center rounded-full bg-muted text-muted-foreground shadow-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/70 hover:text-foreground [&_svg]:size-5",
        className,
      )}
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </button>
  );
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// Three-way segmented control (Light / Dark / System) for settings areas.
export function ThemeSegmentedControl({ className }: { className?: string }) {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const active = mounted ? (theme ?? "system") : undefined;

  return (
    <div
      className={cn("flex gap-1 rounded-lg bg-muted p-1", className)}
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors [&_svg]:size-3.5",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
