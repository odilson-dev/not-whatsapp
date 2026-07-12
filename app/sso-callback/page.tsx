"use client";

import {
  AFTER_AUTH_PATH,
  SIGN_IN_PATH,
  navigateAfterAuth,
} from "@/components/auth/auth-utils";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function SSOCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    void (async () => {
      if (!clerk.loaded || hasRun.current) {
        return;
      }
      hasRun.current = true;

      const goToApp = {
        navigate: async (args: Parameters<typeof navigateAfterAuth>[1]) => {
          navigateAfterAuth(router, args);
        },
      };

      if (signIn.status === "complete") {
        await signIn.finalize(goToApp);
        return;
      }

      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        const transferredStatus = signIn.status as
          | typeof signIn.status
          | "complete";
        if (transferredStatus === "complete") {
          await signIn.finalize(goToApp);
          return;
        }
        router.replace(SIGN_IN_PATH);
        return;
      }

      if (
        signIn.status === "needs_first_factor" &&
        !signIn.supportedFirstFactors?.every(
          (factor) => factor.strategy === "enterprise_sso",
        )
      ) {
        router.replace(SIGN_IN_PATH);
        return;
      }

      if (signIn.isTransferable) {
        await signUp.create({ transfer: true });
        if (signUp.status === "complete") {
          await signUp.finalize(goToApp);
          return;
        }
        router.replace("/sign-up");
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize(goToApp);
        return;
      }

      if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_new_password"
      ) {
        router.replace(SIGN_IN_PATH);
        return;
      }

      const sessionId =
        signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (sessionId) {
        await clerk.setActive({
          session: sessionId,
          navigate: async (args) => {
            navigateAfterAuth(router, args);
          },
        });
        return;
      }

      // Successful OAuth with no extra requirements may already have an active
      // session; land in the app. Otherwise fall back to sign-in.
      if (clerk.session) {
        router.replace(AFTER_AUTH_PATH);
        return;
      }

      router.replace(SIGN_IN_PATH);
    })();
  }, [clerk, router, signIn, signUp]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#00A884] dark:bg-[#111B21]">
      <div className="rounded-xl bg-card px-6 py-4 text-sm text-muted-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        Completing sign-in…
      </div>
      {/* Captcha host for OAuth transfers that require bot protection */}
      <div id="clerk-captcha" />
    </main>
  );
}
