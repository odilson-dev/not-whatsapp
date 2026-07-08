"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery } from "convex/react";
import { Image as ImageIcon, Info, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { formatRelative } from "./format";

export function AdminMessages() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listMessages,
    {},
    { initialNumItems: 30 },
  );
  const deleteMessage = useMutation(api.admin.deleteMessage);

  const [deleteTarget, setDeleteTarget] = useState<Id<"messages"> | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Newest messages across the whole platform. Delete any message that
        violates your rules.
      </p>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <ul className="divide-y divide-border">
          {results.map((m) => (
            <li
              key={m._id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30"
            >
              <UserAvatar
                name={m.senderName ?? "Unknown"}
                imageUrl={m.senderImage}
                className="size-9"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-medium">
                    {m.senderName ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    in {m.conversationTitle}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    · {formatRelative(m.createdAt)}
                  </span>
                  {m.type === "system" ? (
                    <Badge variant="secondary">
                      <Info /> system
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {m.type === "image" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <ImageIcon className="size-3.5" /> Photo
                      {m.imageUrl ? (
                        <a
                          href={m.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          view
                        </a>
                      ) : null}
                    </span>
                  ) : (
                    <span className="break-words">{m.text}</span>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label="Delete message"
                onClick={() => setDeleteTarget(m._id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
          {status === "LoadingFirstPage" ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Loading…
            </li>
          ) : null}
          {status !== "LoadingFirstPage" && results.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No messages yet.
            </li>
          ) : null}
        </ul>
      </div>

      {status === "CanLoadMore" ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMore(30)}>
            Load more
          </Button>
        </div>
      ) : null}
      {status === "LoadingMore" ? (
        <div className="text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : null}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete message?"
        description="This permanently removes the message for everyone in the conversation."
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
                await deleteMessage({ messageId: deleteTarget });
                setDeleteTarget(null);
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to delete");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
