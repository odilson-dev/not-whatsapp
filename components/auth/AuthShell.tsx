import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-[#00A884] dark:bg-[#111B21]">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center text-white">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Not WhatsApp
            </h1>
          </Link>
          <p className="mt-2 text-sm text-white/75">
            Real-time chat — like WhatsApp, but it&apos;s not.
          </p>
        </div>

        <div className="w-full max-w-md rounded-xl bg-card p-6 text-card-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <div className="mb-6 space-y-1 text-center">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </div>
    </main>
  );
}
