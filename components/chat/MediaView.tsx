"use client";

import { Fancybox } from "@/components/chat/Fancybox";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ExternalLink, Images, Link2, Loader2 } from "lucide-react";
import { useState } from "react";

type Tab = "media" | "links";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MediaView() {
  const data = useQuery(api.media.listUserMedia, {});
  const [tab, setTab] = useState<Tab>("media");

  const media = data?.media ?? [];
  const links = data?.links ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
      <header className="px-5 pt-4">
        <h1 className="text-xl font-semibold">Media</h1>
        <p className="text-sm text-foreground/50">
          Everything shared across your chats
        </p>
        <div className="mt-3 flex gap-6 border-b border-border">
          <TabButton
            label="Media"
            icon={<Images className="size-4" />}
            active={tab === "media"}
            count={media.length}
            onClick={() => setTab("media")}
          />
          <TabButton
            label="Links"
            icon={<Link2 className="size-4" />}
            active={tab === "links"}
            count={links.length}
            onClick={() => setTab("links")}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {data === undefined ? (
          <div className="flex justify-center py-16 text-foreground/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : tab === "media" ? (
          media.length === 0 ? (
            <EmptyState
              icon={<Images className="size-10" />}
              text="No media yet. Photos you send or receive will show up here."
            />
          ) : (
            <Fancybox>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {media.map((item) => (
                  <a
                    key={item._id}
                    href={item.imageUrl}
                    data-fancybox="media-gallery"
                    data-caption={`${item.senderName ?? "Unknown"} · ${item.conversationTitle}`}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--card)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt="Media"
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {item.conversationTitle}
                    </span>
                  </a>
                ))}
              </div>
            </Fancybox>
          )
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="size-10" />}
            text="No links yet. Links shared in chats will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {links.map((item, i) => (
              <li key={`${item._id}-${i}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl bg-[var(--card)] p-3 transition-colors hover:bg-accent"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#00A884]/15 text-[#00A884]">
                    <ExternalLink className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[#53bdeb]">
                      {item.url}
                    </div>
                    {item.text && item.text !== item.url ? (
                      <div className="truncate text-sm text-foreground/60">
                        {item.text}
                      </div>
                    ) : null}
                    <div className="mt-0.5 text-xs text-foreground/40">
                      {item.conversationTitle} · {formatDate(item.createdAt)}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  count,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors",
        active
          ? "border-[#00A884] text-foreground"
          : "border-transparent text-foreground/50 hover:text-foreground",
      )}
    >
      {icon}
      {label}
      {count > 0 ? (
        <span className="rounded-full bg-muted px-1.5 text-xs text-foreground/60">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-foreground/40">
      {icon}
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  );
}
