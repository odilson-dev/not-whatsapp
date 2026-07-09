"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicUser } from "./types";

export function NewGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversationId: Id<"conversations">) => void;
}) {
  const createGroup = useMutation(api.conversations.createGroup);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useQuery(
    api.users.search,
    debouncedQuery.length > 0 ? { query: debouncedQuery } : "skip",
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const toggleUser = (user: PublicUser) => {
    setSelected((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user],
    );
  };

  const handleCreate = async () => {
    if (name.trim().length === 0) {
      setError("Please enter a group name");
      return;
    }
    if (selected.length === 0) {
      setError("Add at least one member");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const conversationId = await createGroup({
        name: name.trim(),
        memberIds: selected.map((u) => u._id),
      });
      onCreated(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium">New group</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-foreground/70 hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name"
            autoFocus
            className="w-full rounded-lg bg-[var(--card)] px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((user) => (
                <span
                  key={user._id}
                  className="flex items-center gap-1 rounded-full bg-[var(--muted)] py-1 pr-1 pl-3 text-xs text-foreground"
                >
                  {user.name}
                  <button
                    type="button"
                    onClick={() => toggleUser(user)}
                    className="rounded-full p-0.5 text-foreground/60 hover:bg-accent hover:text-foreground"
                    aria-label={`Remove ${user.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Add members by name or email"
              className="w-full rounded-lg bg-[var(--card)] py-2.5 pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {query.trim().length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              Search for people to add to the group.
            </p>
          ) : results === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              No users found.
            </p>
          ) : (
            results.map((user) => {
              const isSelected = selected.some((u) => u._id === user._id);
              return (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => toggleUser(user)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card)]"
                >
                  <UserAvatar
                    name={user.name}
                    imageUrl={user.profileImage}
                    className="size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user.name}</p>
                    {user.email && (
                      <p className="truncate text-sm text-foreground/50">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-[#00A884] bg-[#00A884] text-white"
                        : "border-border",
                    )}
                  >
                    {isSelected && <Check className="size-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-foreground/40">
              {selected.length} selected
            </p>
          )}
          <Button
            className="bg-[#00A884] text-white hover:bg-[#06cf9c]"
            onClick={() => void handleCreate()}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create group"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
