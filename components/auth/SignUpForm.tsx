"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import {
  AFTER_AUTH_PATH,
  SSO_CALLBACK_PATH,
  absoluteUrl,
  fieldErrorMessage,
  globalErrorMessage,
  navigateAfterAuth,
} from "@/components/auth/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  error,
  visible,
  onToggleVisibility,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          placeholder={placeholder}
          minLength={8}
          aria-invalid={Boolean(error)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className={cn(
            "absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function SignUpForm() {
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace(AFTER_AUTH_PATH);
    }
  }, [isSignedIn, router]);

  const isLoading = fetchStatus === "fetching";

  const needsEmailVerification =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  const handleSubmit = async (formData: FormData) => {
    setFormError(undefined);
    setConfirmError(undefined);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const emailAddress = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }

    const { error } = await signUp.password({
      firstName,
      lastName,
      emailAddress,
      password,
    });
    if (error) {
      setFormError(error.message);
      return;
    }

    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: (args) => navigateAfterAuth(router, args),
      });
      return;
    }

    const { error: verifyError } = await signUp.verifications.sendEmailCode();
    if (verifyError) {
      setFormError(verifyError.message);
    }
  };

  const handleVerify = async (formData: FormData) => {
    setFormError(undefined);
    const code = String(formData.get("code") ?? "").trim();

    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(error.message);
      return;
    }

    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: (args) => navigateAfterAuth(router, args),
      });
      return;
    }

    setFormError("Verification incomplete. Please try again.");
  };

  const handleGoogle = async () => {
    setFormError(undefined);
    const callbackUrl = absoluteUrl(SSO_CALLBACK_PATH);
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      // Always return through the callback so the session is finalized.
      redirectUrl: callbackUrl,
      redirectCallbackUrl: callbackUrl,
    });
    if (error) {
      setFormError(error.longMessage ?? error.message);
    }
  };

  if (isSignedIn) {
    return null;
  }

  if (needsEmailVerification) {
    const codeError = fieldErrorMessage(errors.fields.code);
    const topError = formError ?? globalErrorMessage(errors.global);

    return (
      <AuthShell
        title="Verify your email"
        description="Enter the verification code we sent to your email."
        footer={
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            disabled={isLoading}
            onClick={() => void signUp.verifications.sendEmailCode()}
          >
            Resend code
          </button>
        }
      >
        <form action={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-sm font-medium">
              Verification code
            </label>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              aria-invalid={Boolean(codeError)}
            />
            {codeError ? (
              <p className="text-sm text-destructive">{codeError}</p>
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
            {isLoading ? "Verifying…" : "Verify email"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  const firstNameError = fieldErrorMessage(errors.fields.firstName);
  const lastNameError = fieldErrorMessage(errors.fields.lastName);
  const emailError = fieldErrorMessage(errors.fields.emailAddress);
  const passwordError = fieldErrorMessage(errors.fields.password);
  const topError = formError ?? globalErrorMessage(errors.global);

  return (
    <AuthShell
      title="Create account"
      description="Sign up to start messaging friends and groups."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                placeholder="Ada"
                aria-invalid={Boolean(firstNameError)}
              />
              {firstNameError ? (
                <p className="text-sm text-destructive">{firstNameError}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                placeholder="Lovelace"
                aria-invalid={Boolean(lastNameError)}
              />
              {lastNameError ? (
                <p className="text-sm text-destructive">{lastNameError}</p>
              ) : null}
            </div>
          </div>

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

          <PasswordField
            id="password"
            name="password"
            label="Password"
            placeholder="Create a password"
            autoComplete="new-password"
            error={passwordError}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword((v) => !v)}
          />

          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            error={confirmError}
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword((v) => !v)}
          />

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
            {isLoading ? "Creating account…" : "Sign up"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
