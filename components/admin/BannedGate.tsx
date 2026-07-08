"use client";

import { api } from "@/convex/_generated/api";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Ban } from "lucide-react";

export function BannedGate({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.viewer);
  const { signOut } = useClerk();

  if (me?.isBanned === true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <Ban className="size-8" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-semibold">Your account is banned</h1>
          <p className="text-sm text-muted-foreground">
            {me.banReason && me.banReason.length > 0
              ? me.banReason
              : "An administrator has restricted your access to this platform."}
          </p>
          <p className="text-xs text-muted-foreground">
            If you think this is a mistake, please contact support.
          </p>
        </div>
        <button
          onClick={() => void signOut({ redirectUrl: "/" })}
          className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
