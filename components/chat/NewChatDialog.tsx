"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import type { Id } from "@/convex/_generated/dataModel";
import { Loader2, Search, X } from "lucide-react";
import type { PublicUser } from "./types";

function UserRow({
  user,
  online,
  isLoading,
  onSelect,
}: {
  user: PublicUser;
  online?: boolean;
  isLoading: boolean;
  onSelect: (userId: Id<"users">) => void;
}) {
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => onSelect(user._id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card)] disabled:opacity-60"
    >
      <UserAvatar
        name={user.name}
        imageUrl={user.profileImage}
        className="size-10"
        online={online}
      />
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        {online ? (
          <p className="truncate text-sm text-[#00A884]">Online</p>
        ) : user.email ? (
          <p className="truncate text-sm text-foreground/50">{user.email}</p>
        ) : null}
      </div>
    </button>
  );
}

export function NewChatDialog({
  query,
  onQueryChange,
  results,
  onlineUsers,
  isLoading,
  onClose,
  onSelectUser,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: PublicUser[] | undefined;
  onlineUsers: PublicUser[] | undefined;
  isLoading: boolean;
  onClose: () => void;
  onSelectUser: (userId: Id<"users">) => void;
}) {
  const isSearching = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium">Bother somebody</h2>
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
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search users by name or email"
              autoFocus
              className="w-full rounded-lg bg-[var(--card)] py-2.5 pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto border-t border-border">
          {!isSearching ? (
            onlineUsers === undefined ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-[#00A884]" />
              </div>
            ) : onlineUsers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-foreground/50">
                Nobody&apos;s online right now — search for someone to bother.
              </p>
            ) : (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-foreground/45 uppercase">
                  Online now
                </p>
                {onlineUsers.map((user) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    online
                    isLoading={isLoading}
                    onSelect={onSelectUser}
                  />
                ))}
              </>
            )
          ) : results === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              No users found.
            </p>
          ) : (
            results.map((user) => (
              <UserRow
                key={user._id}
                user={user}
                isLoading={isLoading}
                onSelect={onSelectUser}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
