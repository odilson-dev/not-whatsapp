"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  ShieldAlert,
  UsersRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeSegmentedControl, ThemeToggle } from "@/components/ThemeToggle";
import { AdminConversations } from "./AdminConversations";
import { AdminMessages } from "./AdminMessages";
import { AdminOverview } from "./AdminOverview";
import { AdminUsers } from "./AdminUsers";

type Tab = "overview" | "users" | "groups" | "messages";

const NAV: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "groups", label: "Conversations", icon: UsersRound },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

export function AdminDashboard() {
  const isAdmin = useQuery(api.admin.isCurrentUserAdmin);
  const me = useQuery(api.users.viewer);
  const [tab, setTab] = useState<Tab>("overview");

  if (isAdmin === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              Admin Console
            </div>
            <div className="text-[11px] text-muted-foreground">
              not-whatsapp
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4",
                tab === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="px-1">
            <div className="mb-1.5 px-2 text-[11px] font-medium text-muted-foreground">
              Theme
            </div>
            <ThemeSegmentedControl />
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to app
          </Link>
          {me ? (
            <div className="truncate px-3 text-[11px] text-muted-foreground">
              {me.name}
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        {/* Mobile top nav */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-sidebar p-2 md:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
                tab === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground",
              )}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {NAV.find((n) => n.id === tab)?.label}
              </h1>
              <p className="text-sm text-muted-foreground">
                {DESCRIPTIONS[tab]}
              </p>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Link>
            </div>
          </header>

          {tab === "overview" ? <AdminOverview /> : null}
          {tab === "users" ? <AdminUsers currentUserId={me?._id} /> : null}
          {tab === "groups" ? <AdminConversations /> : null}
          {tab === "messages" ? <AdminMessages /> : null}
        </div>
      </main>
    </div>
  );
}

const DESCRIPTIONS: Record<Tab, string> = {
  overview: "Platform health at a glance.",
  users: "Search, moderate, promote, ban, or remove accounts.",
  groups: "Inspect and delete conversations and groups.",
  messages: "Review and remove message content.",
};

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldAlert className="size-7" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You need administrator privileges to view this page.
        </p>
      </div>
      <Link
        href="/chat"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <ArrowLeft className="size-4" /> Back to app
      </Link>
    </div>
  );
}
