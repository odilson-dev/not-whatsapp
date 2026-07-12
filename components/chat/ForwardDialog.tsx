"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatMessage } from "./types";

export function ForwardDialog({
  message,
  currentConversationId,
  onClose,
}: {
  message: ChatMessage;
  currentConversationId: Id<"conversations">;
  onClose: () => void;
}) {
  const conversations = useQuery(api.conversations.list);
  const forward = useMutation(api.messages.forward);
  const [search, setSearch] = useState("");
  const [forwardingTo, setForwardingTo] = useState<Id<"conversations"> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => {
    if (!conversations) {
      return [];
    }
    const term = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (conversation._id === currentConversationId) {
        return false;
      }
      if (!term) {
        return true;
      }
      return conversation.title.toLowerCase().includes(term);
    });
  }, [conversations, search, currentConversationId]);

  const handleForward = async (targetConversationId: Id<"conversations">) => {
    setForwardingTo(targetConversationId);
    setError(null);
    try {
      await forward({ messageId: message._id, targetConversationId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to forward");
      setForwardingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium text-foreground">
            Forward message to
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-foreground/70 hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              autoFocus
              className="w-full rounded-lg bg-[var(--card)] py-2.5 pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto border-t border-border">
          {conversations === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : targets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              No chats found.
            </p>
          ) : (
            targets.map((conversation) => (
              <button
                key={conversation._id}
                type="button"
                disabled={forwardingTo !== null}
                onClick={() => void handleForward(conversation._id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card)] disabled:opacity-60"
              >
                <UserAvatar
                  name={conversation.title}
                  imageUrl={conversation.avatarUrl}
                  className="size-10"
                  group={conversation.kind === "group"}
                />
                <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {conversation.title}
                </p>
                {forwardingTo === conversation._id && (
                  <Loader2 className="size-4 animate-spin text-[#00A884]" />
                )}
              </button>
            ))
          )}
        </div>
        {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
