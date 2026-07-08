"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Ban,
  Image as ImageIcon,
  MessageSquare,
  Users,
  UsersRound,
  Wifi,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { compactNumber } from "./format";
import { useNow } from "./useNow";

export function AdminOverview() {
  // `now` is captured on the client so the query stays deterministic/cacheable.
  const now = useNow();
  const data = useQuery(api.admin.overview, { now });

  if (data === undefined) {
    return <LoadingGrid />;
  }

  const maxActivity = Math.max(1, ...data.activity.map((a) => a.count));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Users
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total users"
            value={compactNumber(data.users.total)}
            icon={Users}
            hint={`+${data.users.newThisWeek} this week`}
          />
          <StatCard
            label="Active now"
            value={compactNumber(data.users.active)}
            icon={Wifi}
            accent="emerald"
            hint={`+${data.users.newToday} joined today`}
          />
          <StatCard
            label="Admins"
            value={compactNumber(data.users.admins)}
            icon={UsersRound}
            accent="sky"
          />
          <StatCard
            label="Banned"
            value={compactNumber(data.users.banned)}
            icon={Ban}
            accent="rose"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Conversations &amp; messages
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Groups"
            value={compactNumber(data.conversations.groups)}
            icon={UsersRound}
            accent="amber"
            hint={`${data.conversations.direct} direct chats`}
          />
          <StatCard
            label="Total messages"
            value={compactNumber(data.messages.total)}
            icon={MessageSquare}
            hint={`+${data.messages.today} today`}
          />
          <StatCard
            label="Photos shared"
            value={compactNumber(data.messages.image)}
            icon={ImageIcon}
            accent="sky"
          />
          <StatCard
            label="Blocks"
            value={compactNumber(data.blocks)}
            icon={Ban}
            accent="rose"
          />
        </div>
      </section>

      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-sm font-medium">Messages · last 7 days</h2>
        <div className="flex h-40 items-end gap-2">
          {data.activity.map((bucket, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-primary/70 transition-all hover:bg-primary"
                  style={{
                    height: `${Math.max(4, (bucket.count / maxActivity) * 100)}%`,
                  }}
                  title={`${bucket.count} messages`}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {bucket.day}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-xl bg-card ring-1 ring-foreground/10"
        />
      ))}
    </div>
  );
}
