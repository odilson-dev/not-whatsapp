"use client";

import { SIGN_IN_PATH } from "@/components/auth/auth-utils";
import { ThemeSegmentedControl } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/chat/UserAvatar";
import type { Id } from "@/convex/_generated/dataModel";
import { useClerk } from "@clerk/nextjs";
import {
  ChevronRight,
  LogOut,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";

type SettingsUser = {
  _id: Id<"users">;
  name: string;
  email?: string;
  profileImage?: string;
  role?: "admin" | "user";
};

export function SettingsView({ currentUser }: { currentUser: SettingsUser }) {
  const { signOut } = useClerk();

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
      <header className="px-5 py-4">
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Profile card */}
        <Link
          href="/profile"
          className="mx-5 flex items-center gap-4 rounded-2xl bg-[var(--card)] p-4 transition-colors hover:bg-accent"
        >
          <UserAvatar
            name={currentUser.name}
            imageUrl={currentUser.profileImage}
            className="size-16"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">
              {currentUser.name}
            </div>
            {currentUser.email ? (
              <div className="truncate text-sm text-foreground/50">
                {currentUser.email}
              </div>
            ) : null}
          </div>
          <ChevronRight className="size-5 shrink-0 text-foreground/40" />
        </Link>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex items-center gap-3 px-4 py-3">
            <SectionIcon>
              <Palette className="size-5" />
            </SectionIcon>
            <div className="flex-1">
              <div className="font-medium">Theme</div>
              <div className="text-sm text-foreground/50">
                Choose light, dark, or match your system
              </div>
            </div>
            <ThemeSegmentedControl />
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <Row
            icon={<UserRound className="size-5" />}
            label="Profile"
            sub="Name, photo, about"
            href="/profile"
          />
          {currentUser.role === "admin" ? (
            <Row
              icon={<ShieldCheck className="size-5" />}
              label="Admin dashboard"
              sub="Manage users, chats and messages"
              href="/admin"
            />
          ) : null}
        </Section>

        {/* Danger */}
        <div className="mt-6 px-5">
          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: SIGN_IN_PATH })}
            className="flex w-full items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <LogOut className="size-5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="px-5 pb-2 text-xs font-medium uppercase tracking-wide text-foreground/40">
        {title}
      </div>
      <div className="mx-5 divide-y divide-border overflow-hidden rounded-2xl bg-[var(--card)]">
        {children}
      </div>
    </div>
  );
}

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
      {children}
    </span>
  );
}

function Row({
  icon,
  label,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
    >
      <SectionIcon>{icon}</SectionIcon>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {sub ? <div className="text-sm text-foreground/50">{sub}</div> : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-foreground/40" />
    </Link>
  );
}
