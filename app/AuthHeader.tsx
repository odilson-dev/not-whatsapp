"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/convex/_generated/api";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthHeader() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const isAdmin = useQuery(
    api.admin.isCurrentUserAdmin,
    isSignedIn ? {} : "skip",
  );

  if (!isSignedIn) {
    return null;
  }

  const onChat = pathname.startsWith("/chat");
  const onAdmin = pathname.startsWith("/admin");

  // On the admin page the console has its own nav, so render nothing.
  if (onAdmin) {
    return null;
  }

  const adminLink =
    isAdmin === true ? (
      <Link
        href="/admin"
        aria-label="Admin dashboard"
        title="Admin dashboard"
        className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20 transition-colors hover:bg-primary/25"
      >
        <ShieldAlert className="size-5" />
      </Link>
    ) : null;

  // The chat page has its own theme toggle in its header; only surface the admin
  // shortcut here (when applicable).
  if (onChat) {
    if (!adminLink) return null;
    return (
      <header className="fixed bottom-4 right-4 z-50">{adminLink}</header>
    );
  }

  return (
    <header className="fixed right-4 top-4 z-50 flex items-center gap-3">
      <ThemeToggle />
      {adminLink}
      <UserButton />
    </header>
  );
}
