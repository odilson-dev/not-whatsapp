"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { MessageSquare, Search, Trash2, User, Users } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { formatRelative } from "./format";

type Filter = "all" | "group" | "direct";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "group", label: "Groups" },
  { id: "direct", label: "Direct" },
];

export function AdminConversations() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const data = useQuery(api.admin.listConversations, {
    search: search || undefined,
    filter,
  });
  const deleteConversation = useMutation(api.admin.deleteConversation);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"conversations">;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const conversations = data?.conversations ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (filter === f.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {data === undefined
          ? "Loading…"
          : `${data.total} conversation${data.total === 1 ? "" : "s"}`}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {conversations.map((c) => {
          const isGroup = c.kind === "group";
          const title = isGroup
            ? c.name ?? "Unnamed group"
            : c.memberNames.join(", ") || "Direct chat";
          return (
            <div
              key={c._id}
              className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <UserAvatar
                name={title}
                imageUrl={c.imageUrl}
                group={isGroup}
                className="size-11"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{title}</span>
                  <Badge variant={isGroup ? "warning" : "secondary"}>
                    {isGroup ? <Users /> : <User />}
                    {isGroup ? "Group" : "Direct"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" /> {c.memberCount} members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3" /> {c.messageCount}{" "}
                    messages
                  </span>
                  <span>active {formatRelative(c.lastMessageAt)}</span>
                </div>
                {c.createdByName ? (
                  <div className="mt-0.5 text-xs text-muted-foreground/80">
                    created by {c.createdByName}
                  </div>
                ) : null}
                {c.lastMessagePreview ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    “{c.lastMessagePreview}”
                  </div>
                ) : null}
              </div>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label="Delete conversation"
                onClick={() => setDeleteTarget({ id: c._id, title })}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </div>

      {data !== undefined && conversations.length === 0 ? (
        <div className="rounded-xl bg-card py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No conversations found.
        </div>
      ) : null}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete conversation?"
        description={`This permanently deletes "${deleteTarget?.title ?? ""}" and all of its messages for everyone. This cannot be undone.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!deleteTarget) return;
              setBusy(true);
              try {
                await deleteConversation({
                  conversationId: deleteTarget.id,
                });
                setDeleteTarget(null);
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to delete");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 /> Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}
