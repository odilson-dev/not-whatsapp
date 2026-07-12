"use client";

import { AFTER_AUTH_PATH } from "@/components/auth/auth-utils";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#00A884] dark:bg-[#111B21]">
      <div className="rounded-xl bg-card px-6 py-4 text-sm text-muted-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        Completing sign-in…
      </div>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl={AFTER_AUTH_PATH}
        signUpForceRedirectUrl={AFTER_AUTH_PATH}
      />
    </main>
  );
}
