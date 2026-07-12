"use client";

import { Modal } from "@/components/admin/Modal";
import { useNow } from "@/components/admin/useNow";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type StatusItem = {
  _id: Id<"statuses">;
  type: "text" | "image";
  text?: string;
  imageUrl?: string;
  backgroundColor?: string;
  createdAt: number;
  viewed: boolean;
};

type Bucket = {
  user: { _id: Id<"users">; name: string; profileImage?: string };
  statuses: StatusItem[];
  hasUnviewed: boolean;
  latestAt: number;
};

const BG_COLORS = [
  "#00A884",
  "#075E54",
  "#128C7E",
  "#553639",
  "#1F2C34",
  "#5B51D8",
  "#E17055",
  "#0984E3",
];

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}

export function StatusView({
  currentUser,
}: {
  currentUser: { _id: Id<"users">; name: string; profileImage?: string };
}) {
  const now = useNow();
  const data = useQuery(api.status.listActive, { now });
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewing, setViewing] = useState<Bucket | null>(null);

  const me = data?.me ?? null;
  const others = data?.others ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-xl font-semibold">Status</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* My status */}
        <button
          type="button"
          onClick={() => {
            if (me && me.statuses.length > 0) setViewing(me);
            else setComposerOpen(true);
          }}
          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--card)]"
        >
          <div className="relative">
            <StatusRing
              hasUnviewed={me?.hasUnviewed ?? false}
              hasStatus={(me?.statuses.length ?? 0) > 0}
            >
              <UserAvatar
                name={currentUser.name}
                imageUrl={currentUser.profileImage}
                className="size-12"
              />
            </StatusRing>
            <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[#00A884] text-white ring-2 ring-[var(--background)]">
              <Plus className="size-3.5" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium">My status</div>
            <div className="truncate text-sm text-foreground/50">
              {me && me.statuses.length > 0
                ? `${me.statuses.length} update${me.statuses.length > 1 ? "s" : ""} · ${timeAgo(me.latestAt)}`
                : "Tap to add status update"}
            </div>
          </div>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setComposerOpen(true);
            }}
            className="ml-auto flex size-9 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-5"
          >
            <ImagePlus />
          </span>
        </button>

        <div className="px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-foreground/40">
          Recent updates
        </div>

        {data === undefined ? (
          <div className="flex justify-center py-10 text-foreground/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : others.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-foreground/50">
            No recent updates. Statuses disappear after 24 hours.
          </div>
        ) : (
          others.map((bucket) => (
            <button
              key={bucket.user._id}
              type="button"
              onClick={() => setViewing(bucket)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--card)]"
            >
              <StatusRing hasUnviewed={bucket.hasUnviewed} hasStatus>
                <UserAvatar
                  name={bucket.user.name}
                  imageUrl={bucket.user.profileImage}
                  className="size-12"
                />
              </StatusRing>
              <div className="min-w-0">
                <div className="truncate font-medium">{bucket.user.name}</div>
                <div className="text-sm text-foreground/50">
                  {timeAgo(bucket.latestAt)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {composerOpen ? (
        <StatusComposer onClose={() => setComposerOpen(false)} />
      ) : null}

      {viewing ? (
        <StatusViewer
          bucket={viewing}
          isMe={viewing.user._id === currentUser._id}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}

function StatusRing({
  hasUnviewed,
  hasStatus,
  children,
}: {
  hasUnviewed: boolean;
  hasStatus: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-full p-[2px]",
        hasStatus
          ? hasUnviewed
            ? "bg-[#00A884]"
            : "bg-foreground/25"
          : "bg-transparent",
      )}
    >
      <div className="rounded-full bg-[var(--background)] p-[2px]">
        {children}
      </div>
    </div>
  );
}

function StatusComposer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = useMutation(api.status.post);
  const generateUploadUrl = useMutation(api.status.generateUploadUrl);

  const submitText = async () => {
    if (text.trim().length === 0) {
      setError("Write something first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post({ text, backgroundColor: bg });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post status");
    } finally {
      setBusy(false);
    }
  };

  const submitImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      await post({ imageStorageId: storageId, text: text.trim() || undefined });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New status">
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setMode("text")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
            mode === "text"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Type /> Text
        </button>
        <button
          onClick={() => setMode("image")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
            mode === "image"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ImagePlus /> Photo
        </button>
      </div>

      {mode === "text" ? (
        <>
          <div
            className="flex min-h-40 items-center justify-center rounded-xl p-6"
            style={{ backgroundColor: bg }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a status…"
              autoFocus
              maxLength={280}
              className="w-full resize-none bg-transparent text-center text-xl font-medium text-white outline-none placeholder:text-white/60"
              rows={3}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setBg(c)}
                style={{ backgroundColor: c }}
                aria-label={`Background ${c}`}
                className={cn(
                  "size-7 rounded-full ring-2 transition-transform hover:scale-110",
                  bg === c ? "ring-foreground" : "ring-transparent",
                )}
              />
            ))}
          </div>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-[#00A884] text-white hover:bg-[#06cf9c]"
              disabled={busy}
              onClick={() => void submitText()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Share"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-foreground/60 transition-colors hover:bg-muted"
          >
            {busy ? (
              <Loader2 className="size-8 animate-spin" />
            ) : (
              <>
                <ImagePlus className="size-8" />
                <span className="text-sm">Choose a photo to share</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void submitImage(file);
            }}
          />
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function StatusViewer({
  bucket,
  isMe,
  onClose,
}: {
  bucket: Bucket;
  isMe: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const markViewed = useMutation(api.status.markViewed);
  const removeStatus = useMutation(api.status.remove);
  const current = bucket.statuses[index];

  const goNext = () => {
    if (index < bucket.statuses.length - 1) setIndex((i) => i + 1);
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  useEffect(() => {
    if (!current || isMe) return;
    void markViewed({ statusId: current._id });
  }, [current, isMe, markViewed]);

  // Auto-advance every 5s.
  useEffect(() => {
    const t = setTimeout(goNext, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95">
      {/* Progress bars */}
      <div className="flex gap-1 p-3">
        {bucket.statuses.map((s, i) => (
          <div
            key={s._id}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className={cn(
                "h-full rounded-full bg-white",
                i < index ? "w-full" : i === index ? "w-full" : "w-0",
              )}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 pb-3">
        <UserAvatar
          name={bucket.user.name}
          imageUrl={bucket.user.profileImage}
          className="size-9"
        />
        <div className="min-w-0">
          <div className="truncate font-medium text-white">
            {bucket.user.name}
          </div>
          <div className="text-xs text-white/60">{timeAgo(current.createdAt)}</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {isMe ? (
            <button
              onClick={async () => {
                await removeStatus({ statusId: current._id });
                if (bucket.statuses.length <= 1) onClose();
                else setIndex((i) => Math.max(0, i - 1));
              }}
              aria-label="Delete status"
              className="flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 [&_svg]:size-5"
            >
              <Trash2 />
            </button>
          ) : null}
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 [&_svg]:size-5"
          >
            <X />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* tap zones */}
        <button
          onClick={goPrev}
          aria-label="Previous"
          className="absolute left-0 top-0 z-10 flex h-full w-1/3 items-center justify-start pl-2 text-white/0 hover:text-white/70 [&_svg]:size-7"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={goNext}
          aria-label="Next"
          className="absolute right-0 top-0 z-10 flex h-full w-1/3 items-center justify-end pr-2 text-white/0 hover:text-white/70 [&_svg]:size-7"
        >
          <ChevronRight />
        </button>

        {current.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt="Status"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div
            className="flex size-full max-h-[70vh] max-w-2xl items-center justify-center rounded-none p-10"
            style={{ backgroundColor: current.backgroundColor ?? "#00A884" }}
          >
            <p className="text-center text-2xl font-medium text-white">
              {current.text}
            </p>
          </div>
        )}
      </div>

      {current.type === "image" && current.text ? (
        <p className="px-6 py-4 text-center text-white">{current.text}</p>
      ) : null}
    </div>
  );
}
