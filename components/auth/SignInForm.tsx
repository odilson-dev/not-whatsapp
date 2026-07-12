"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import {
  AFTER_AUTH_PATH,
  SSO_CALLBACK_PATH,
  fieldErrorMessage,
  globalErrorMessage,
  navigateAfterAuth,
} from "@/components/auth/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SignInForm() {
  const { isSignedIn } = useAuth();
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [formError, setFormError] = useState<string | undefined>();

  useEffect(() => {
    if (isSignedIn) {
      router.replace(AFTER_AUTH_PATH);
    }
  }, [isSignedIn, router]);

  const isLoading = fetchStatus === "fetching";

  const handleSubmit = async (formData: FormData) => {
    setFormError(undefined);
    const emailAddress = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError(error.message);
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: (args) => navigateAfterAuth(router, args),
      });
      return;
    }

    setFormError("Additional verification is required. Please try again or use Google.");
  };

  const handleGoogle = async () => {
    setFormError(undefined);
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: AFTER_AUTH_PATH,
      redirectCallbackUrl: SSO_CALLBACK_PATH,
    });
    if (error) {
      setFormError(error.message);
    }
  };

  if (isSignedIn) {
    return null;
  }

  const emailError = fieldErrorMessage(errors.fields.identifier);
  const passwordError = fieldErrorMessage(errors.fields.password);
  const topError = formError ?? globalErrorMessage(errors.global);

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back. Sign in to continue chatting."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton
          label="Continue with Google"
          disabled={isLoading}
          onClick={() => void handleGoogle()}
        />

        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={Boolean(emailError)}
            />
            {emailError ? (
              <p className="text-sm text-destructive">{emailError}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError ? (
              <p className="text-sm text-destructive">{passwordError}</p>
            ) : null}
          </div>

          {topError ? (
            <p className="text-sm text-destructive" role="alert">
              {topError}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-10 w-full"
            disabled={isLoading}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
