"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { formatConversationTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Camera,
  Check,
  CheckCheck,
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  Pin,
  PinOff,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import type { ConversationPreview } from "./types";

export function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-[#00A884]/20 text-[#00A884]"
          : "bg-[var(--card)] text-foreground/60 hover:bg-[var(--muted)] hover:text-foreground/80",
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "ml-1",
            active ? "text-[#00A884]" : "text-foreground/40",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function ConversationListItem({
  conversation,
  isSelected,
  isOnline,
  onSelect,
  selectionMode = false,
  checked = false,
}: {
  conversation: ConversationPreview;
  isSelected: boolean;
  isOnline: boolean;
  onSelect: () => void;
  selectionMode?: boolean;
  checked?: boolean;
}) {
  const isGroup = conversation.kind === "group";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group/row flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--card)]",
        isSelected && "bg-[var(--muted)]",
        selectionMode && checked && "bg-[var(--muted)]",
      )}
    >
      {selectionMode && (
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            checked
              ? "border-[#00A884] bg-[#00A884] text-white"
              : "border-foreground/30",
          )}
        >
          {checked && <Check className="size-3.5" />}
        </span>
      )}
      <UserAvatar
        name={conversation.title}
        imageUrl={conversation.avatarUrl}
        className="size-12"
        group={isGroup}
        online={isGroup ? undefined : isOnline}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate font-medium text-foreground",
              conversation.unread && "font-semibold",
            )}
          >
            {conversation.title}
          </p>
          <span
            className={cn(
              "shrink-0 text-xs text-foreground/45",
              conversation.unread && "text-[#00A884]",
            )}
          >
            {formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-foreground/50">
          {conversation.lastMessageType === "image" && (
            <Camera className="size-3.5 shrink-0" />
          )}
          <p
            className={cn(
              "truncate",
              conversation.unread && "font-medium text-foreground/80",
            )}
          >
            {conversation.lastMessagePreview ??
              (isGroup
                ? `${conversation.memberCount} members`
                : "No messages yet")}
          </p>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {conversation.isBlocked && (
              <Ban className="size-3.5 text-destructive/70" />
            )}
            {conversation.isFavorite && (
              <Star className="size-3.5 fill-[#00A884] text-[#00A884]" />
            )}
            {conversation.isPinned && (
              <Pin className="size-3.5 text-foreground/45" />
            )}
            {conversation.unread && (
              <span className="size-2.5 rounded-full bg-[#00A884]" />
            )}
          </span>
        </div>
      </div>

      {!selectionMode && (
        <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          <ConversationActionsMenu
            conversation={conversation}
            align="start"
            side="bottom"
            triggerClassName="rounded-full p-1.5 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          />
        </div>
      )}
    </div>
  );
}

export function ConversationActionsMenu({
  conversation,
  align = "end",
  side = "bottom",
  triggerClassName,
  onDeleted,
}: {
  conversation: ConversationPreview;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  triggerClassName?: string;
  onDeleted?: () => void;
}) {
  const setArchived = useMutation(api.conversations.setArchived);
  const setPinned = useMutation(api.conversations.setPinned);
  const setFavorite = useMutation(api.conversations.setFavorite);
  const markRead = useMutation(api.conversations.markRead);
  const markUnread = useMutation(api.conversations.markUnread);
  const setBlocked = useMutation(api.conversations.setBlocked);
  const removeConversation = useMutation(api.conversations.remove);
  const leaveGroup = useMutation(api.conversations.leaveGroup);

  const conversationId = conversation._id;
  const isGroup = conversation.kind === "group";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Conversation options"
        className={triggerClassName}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreVertical className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side}>
        <DropdownMenuItem
          onClick={() =>
            void setArchived({
              conversationId,
              archived: !conversation.isArchived,
            })
          }
        >
          {conversation.isArchived ? <ArchiveRestore /> : <Archive />}
          {conversation.isArchived ? "Unarchive chat" : "Archive chat"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void setPinned({ conversationId, pinned: !conversation.isPinned })
          }
        >
          {conversation.isPinned ? <PinOff /> : <Pin />}
          {conversation.isPinned ? "Unpin chat" : "Pin chat"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void (conversation.unread
              ? markRead({ conversationId })
              : markUnread({ conversationId }))
          }
        >
          <CheckCheck />
          {conversation.unread ? "Mark as read" : "Mark as unread"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void setFavorite({
              conversationId,
              favorite: !conversation.isFavorite,
            })
          }
        >
          {conversation.isFavorite ? <StarOff /> : <Star />}
          {conversation.isFavorite
            ? "Remove from favorites"
            : "Add to favorites"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isGroup && conversation.otherUser && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              void setBlocked({
                otherUserId: conversation.otherUser!._id,
                blocked: !conversation.isBlocked,
              })
            }
          >
            <Ban />
            {conversation.isBlocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
        )}
        {isGroup && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void leaveGroup({ conversationId });
              onDeleted?.();
            }}
          >
            <LogOut />
            Leave group
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void removeConversation({ conversationId });
            onDeleted?.();
          }}
        >
          <Trash2 />
          Delete chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmptyChatState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[var(--card)] text-center">
      <div className="mb-6 rounded-full bg-[var(--card)] p-8">
        <MessageSquarePlus className="size-16 text-foreground/20" />
      </div>

      <p className="mt-3 max-w-sm text-base text-foreground/50">
        Where your aunty comes to gossip .
      </p>
      <button
        type="button"
        onClick={onNewChat}
        className="mt-8 cursor-pointer text-white rounded-lg bg-[#00A884] px-6 py-2.5 text-sm font-semibold  transition-colors hover:bg-[#06CF9C]"
      >
        Bother Somebody
      </button>
    </div>
  );
}
