"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Modal } from "@/components/admin/Modal";
import { Fancybox } from "@/components/chat/Fancybox";
import { MediaView } from "@/components/chat/MediaView";
import { NavRail, type ChatSection } from "@/components/chat/NavRail";
import { SettingsView } from "@/components/chat/SettingsView";
import { StatusView } from "@/components/chat/StatusView";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatConversationTime,
  formatLastSeen,
  formatMessageTime,
} from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/nextjs";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Crown,
  Download,
  Forward,
  ListChecks,
  Loader2,
  LogOut,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Search,
  Shield,
  ShieldCheck,
  Star,
  StarOff,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PublicUser = {
  _id: Id<"users">;
  name: string;
  email?: string;
  profileImage?: string;
  lastSeen?: number;
};

type GroupMember = PublicUser & { role: "admin" | "member" };

type ConversationPreview = {
  _id: Id<"conversations">;
  kind: "direct" | "group";
  title: string;
  avatarUrl?: string;
  memberCount: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
  lastMessageType?: "text" | "image";
  otherUser?: PublicUser;
  otherLastSeen?: number;
  isArchived: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  unread: boolean;
  isBlocked: boolean;
};

type FilterKey = "all" | "unread" | "favorites" | "groups";

const ONLINE_THRESHOLD_MS = 60_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

function presenceLabel(lastSeen: number | undefined, now: number): string {
  if (lastSeen === undefined) {
    return "";
  }
  if (now - lastSeen < ONLINE_THRESHOLD_MS) {
    return "online";
  }
  return formatLastSeen(lastSeen);
}

type MessageReceipt = "sent" | "delivered" | "read";

type ChatMessage = {
  _id: Id<"messages">;
  _creationTime: number;
  conversationId: Id<"conversations">;
  senderId: Id<"users">;
  type: "text" | "image" | "system";
  text?: string;
  imageUrl?: string;
  createdAt: number;
  forwarded?: boolean;
  mentions?: Id<"users">[];
  replyTo?: {
    messageId: Id<"messages">;
    senderId: Id<"users">;
    type: "text" | "image" | "system";
    text?: string;
  };
  senderName?: string;
  senderImage?: string;
};

function formatDaySeparator(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

const MENTION_QUERY_REGEX = /(?:^|\s)@([^\s@]*)$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Splits text into plain strings and highlighted @mention tokens.
function renderTextWithMentions(
  text: string,
  mentionNames: string[],
): (string | { mention: string })[] {
  if (mentionNames.length === 0) {
    return [text];
  }
  const pattern = new RegExp(
    `@(?:${mentionNames.map(escapeRegExp).join("|")})`,
    "g",
  );
  const parts: (string | { mention: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ mention: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export function ChatPage() {
  const currentUser = useQuery(api.users.me);
  const conversations = useQuery(api.conversations.list);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const markRead = useMutation(api.conversations.markRead);
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    void heartbeat();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heartbeat]);

  const now = useNow(30000);
  const { signOut } = useClerk();
  const removeConversation = useMutation(api.conversations.remove);
  const [activeSection, setActiveSection] = useState<ChatSection>("chats");
  const statusOverview = useQuery(api.status.listActive, { now });
  const hasStatusUpdates =
    statusOverview?.others.some((bucket) => bucket.hasUnviewed) ?? false;
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"conversations">>>(
    new Set(),
  );
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState("");
  const [debouncedNewChatQuery, setDebouncedNewChatQuery] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);

  const searchResults = useQuery(
    api.users.search,
    debouncedNewChatQuery.length > 0
      ? { query: debouncedNewChatQuery }
      : "skip",
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedNewChatQuery(newChatQuery);
    }, 250);

    return () => clearTimeout(timeout);
  }, [newChatQuery]);

  const activeConversations = useMemo(
    () => conversations?.filter((c) => !c.isArchived) ?? [],
    [conversations],
  );

  const archivedCount = useMemo(
    () => conversations?.filter((c) => c.isArchived).length ?? 0,
    [conversations],
  );

  const counts = useMemo(
    () => ({
      unread: activeConversations.filter((c) => c.unread).length,
      favorites: activeConversations.filter((c) => c.isFavorite).length,
      groups: activeConversations.filter((c) => c.kind === "group").length,
    }),
    [activeConversations],
  );

  const filteredConversations = useMemo(() => {
    if (!conversations) {
      return [];
    }

    const term = sidebarSearch.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesView = showArchived
        ? conversation.isArchived
        : !conversation.isArchived;
      if (!matchesView) {
        return false;
      }

      if (!showArchived) {
        if (activeFilter === "unread" && !conversation.unread) {
          return false;
        }
        if (activeFilter === "favorites" && !conversation.isFavorite) {
          return false;
        }
        if (activeFilter === "groups" && conversation.kind !== "group") {
          return false;
        }
      }

      if (!term) {
        return true;
      }
      return conversation.title.toLowerCase().includes(term);
    });
  }, [conversations, sidebarSearch, showArchived, activeFilter]);

  const selectedConversation = conversations?.find(
    (conversation) => conversation._id === selectedConversationId,
  );
  // Derive the actually-open conversation id from the list so a stale selection
  // (e.g. a chat that was just deleted) is treated as "nothing open" without
  // needing to reset state in an effect.
  const openConversationId = selectedConversation?._id ?? null;

  const handleSelectConversation = (conversationId: Id<"conversations">) => {
    setSelectedConversationId(conversationId);
    void markRead({ conversationId });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (conversationId: Id<"conversations">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredConversations.map((c) => c._id)));
  };

  const markSelectedRead = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((conversationId) => markRead({ conversationId })),
    );
    exitSelectionMode();
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((conversationId) => removeConversation({ conversationId })),
    );
    if (selectedConversationId && selectedIds.has(selectedConversationId)) {
      setSelectedConversationId(null);
    }
    setConfirmBulkDelete(false);
    exitSelectionMode();
  };

  const startChatWithUser = async (otherUserId: Id<"users">) => {
    setIsStartingChat(true);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId });
      setShowArchived(false);
      setActiveFilter("all");
      handleSelectConversation(conversationId);
      setShowNewChat(false);
      setNewChatQuery("");
      setDebouncedNewChatQuery("");
    } finally {
      setIsStartingChat(false);
    }
  };

  if (currentUser === undefined || conversations === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-foreground">
        <Loader2 className="size-8 animate-spin text-[#00A884]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--background)] text-foreground">
      <NavRail
        active={activeSection}
        onChange={setActiveSection}
        currentUser={currentUser}
        unreadChats={counts.unread}
        hasStatusUpdates={hasStatusUpdates}
        className={cn(
          activeSection === "chats" &&
            openConversationId &&
            "hidden md:flex",
        )}
      />
      {activeSection === "chats" && (
        <aside
          className={cn(
            "flex w-full flex-col border-r border-border bg-[var(--background)] md:w-[420px] md:max-w-[40%]",
            openConversationId && "hidden md:flex",
          )}
        >
          {selectionMode ? (
            <header className="flex items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={exitSelectionMode}
                className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Cancel selection"
              >
                <X className="size-5" />
              </button>
              <span className="text-base font-medium">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : "Select chats"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Select all"
                  title="Select all"
                >
                  <ListChecks className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => void markSelectedRead()}
                  disabled={selectedIds.size === 0}
                  className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Mark as read"
                  title="Mark as read"
                >
                  <CheckCheck className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={selectedIds.size === 0}
                  className="rounded-full p-2 text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Delete"
                  title="Delete"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            </header>
          ) : (
            <header className="flex items-center justify-between px-4 py-3">
              <h1 className="text-xl font-semibold tracking-tight">
                Not Whatsapp
              </h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowNewChat(true)}
                  className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="New chat"
                >
                  <MessageSquare className="size-5" />
                </button>
                <ThemeToggle
                  bare
                  className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Menu"
                    className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MoreVertical className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem onClick={() => setShowNewGroup(true)}>
                      <Users />
                      New group
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={enterSelectionMode}>
                      <ListChecks />
                      Select chats
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void signOut({ redirectUrl: "/" })}
                    >
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
          )}

          <div className="px-3 pb-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40" />
              <input
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Search"
                className="w-full rounded-lg bg-[var(--card)] py-2 pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
              />
            </label>
          </div>

          {!showArchived && (
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              <FilterChip
                label="All"
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
              />
              <FilterChip
                label="Unread"
                count={counts.unread}
                active={activeFilter === "unread"}
                onClick={() => setActiveFilter("unread")}
              />
              <FilterChip
                label="Favorites"
                count={counts.favorites}
                active={activeFilter === "favorites"}
                onClick={() => setActiveFilter("favorites")}
              />
              <FilterChip
                label="Groups"
                count={counts.groups}
                active={activeFilter === "groups"}
                onClick={() => setActiveFilter("groups")}
              />
            </div>
          )}

          {showArchived && (
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-[var(--card)]"
            >
              <ArrowLeft className="size-4" />
              <span className="font-medium">Archived</span>
            </button>
          )}

          {!showArchived &&
            archivedCount > 0 &&
            activeFilter === "all" &&
            sidebarSearch.trim() === "" && (
              <button
                type="button"
                onClick={() => setShowArchived(true)}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-[var(--card)]"
              >
                <Archive className="size-4 text-[#00A884]" />
                <span className="font-medium">Archived</span>
                <span className="ml-auto text-xs text-foreground/45">
                  {archivedCount}
                </span>
              </button>
            )}

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-foreground/50">
                {showArchived
                  ? "No archived chats."
                  : conversations.length === 0
                    ? "No chats yet. Start a new conversation."
                    : "No chats match this filter."}
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationListItem
                  key={conversation._id}
                  conversation={conversation}
                  isSelected={
                    !selectionMode &&
                    openConversationId === conversation._id
                  }
                  isOnline={
                    conversation.kind === "direct" &&
                    conversation.otherLastSeen !== undefined &&
                    now - conversation.otherLastSeen < ONLINE_THRESHOLD_MS
                  }
                  selectionMode={selectionMode}
                  checked={selectedIds.has(conversation._id)}
                  onSelect={() =>
                    selectionMode
                      ? toggleSelected(conversation._id)
                      : handleSelectConversation(conversation._id)
                  }
                />
              ))
            )}
          </div>
        </aside>
      )}

      {activeSection === "chats" && (
        <section className="hidden min-w-0 flex-1 md:flex">
          {selectedConversation ? (
            <MessagePanel
              key={selectedConversation._id}
              conversation={selectedConversation}
              currentUserId={currentUser._id}
              onDeleted={() => setSelectedConversationId(null)}
            />
          ) : (
            <EmptyChatState />
          )}
        </section>
      )}

      {activeSection === "chats" && selectedConversation && (
        <section className="flex min-w-0 flex-1 md:hidden">
          <MessagePanel
            key={selectedConversation._id}
            conversation={selectedConversation}
            currentUserId={currentUser._id}
            onBack={() => setSelectedConversationId(null)}
            onDeleted={() => setSelectedConversationId(null)}
          />
        </section>
      )}

      {activeSection === "status" && <StatusView currentUser={currentUser} />}

      {activeSection === "media" && <MediaView />}

      {activeSection === "settings" && (
        <SettingsView currentUser={currentUser} />
      )}

      {showNewChat && (
        <NewChatDialog
          query={newChatQuery}
          onQueryChange={setNewChatQuery}
          results={searchResults}
          isLoading={isStartingChat}
          onClose={() => {
            setShowNewChat(false);
            setNewChatQuery("");
            setDebouncedNewChatQuery("");
          }}
          onSelectUser={(userId) => void startChatWithUser(userId)}
        />
      )}

      {showNewGroup && (
        <NewGroupDialog
          onClose={() => setShowNewGroup(false)}
          onCreated={(conversationId) => {
            setShowNewGroup(false);
            setShowArchived(false);
            setActiveFilter("all");
            handleSelectConversation(conversationId);
          }}
        />
      )}

      {confirmBulkDelete && (
        <Modal
          open
          onClose={() => setConfirmBulkDelete(false)}
          title="Delete chats?"
          description={`This will delete ${selectedIds.size} chat${
            selectedIds.size > 1 ? "s" : ""
          } from your list.`}
        >
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmBulkDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteSelected()}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterChip({
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

function ConversationListItem({
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

function ConversationActionsMenu({
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

function EmptyChatState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[var(--card)] text-center">
      <div className="mb-6 rounded-full bg-[var(--card)] p-8">
        <MessageSquare className="size-16 text-foreground/20" />
      </div>
      <h2 className="text-2xl font-light text-foreground/90">
        Not Whatsapp Web
      </h2>
      <p className="mt-3 max-w-sm text-sm text-foreground/50">
        Select a chat from the sidebar to start messaging.
      </p>
    </div>
  );
}

function NewChatDialog({
  query,
  onQueryChange,
  results,
  isLoading,
  onClose,
  onSelectUser,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: PublicUser[] | undefined;
  isLoading: boolean;
  onClose: () => void;
  onSelectUser: (userId: Id<"users">) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium">New chat</h2>
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
          {query.trim().length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              Type to find someone to chat with.
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
            results.map((user) => (
              <button
                key={user._id}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectUser(user._id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card)] disabled:opacity-60"
              >
                <UserAvatar
                  name={user.name}
                  imageUrl={user.profileImage}
                  className="size-10"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  {user.email && (
                    <p className="truncate text-sm text-foreground/50">
                      {user.email}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NewGroupDialog({
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

function MessagePanel({
  conversation,
  currentUserId,
  onBack,
  onDeleted,
}: {
  conversation: ConversationPreview;
  currentUserId: Id<"users">;
  onBack?: () => void;
  onDeleted?: () => void;
}) {
  const conversationId = conversation._id;
  const isGroup = conversation.kind === "group";
  const otherUser = conversation.otherUser;
  const isBlocked = !isGroup && conversation.isBlocked;
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const markRead = useMutation(api.conversations.markRead);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const otherStatus = useQuery(
    api.conversations.otherMemberStatus,
    isGroup ? "skip" : { conversationId },
  );
  const groupMembers = useQuery(
    api.conversations.members,
    isGroup ? { conversationId } : "skip",
  );
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { conversationId },
    { initialNumItems: 50 },
  );

  const now = useNow(30000);
  const otherLastReadAt = otherStatus?.lastReadAt ?? 0;
  const otherLastSeen = otherStatus?.lastSeen;
  const presence = isGroup ? "" : presenceLabel(otherLastSeen, now);

  const groupSubtitle = useMemo(() => {
    if (!isGroup) {
      return "";
    }
    if (!groupMembers) {
      return `${conversation.memberCount} members`;
    }
    return groupMembers
      .map((member) => (member._id === currentUserId ? "You" : member.name))
      .join(", ");
  }, [isGroup, groupMembers, conversation.memberCount, currentUserId]);

  const iAmAdmin = useMemo(
    () =>
      groupMembers?.some(
        (member) => member._id === currentUserId && member.role === "admin",
      ) ?? false,
    [groupMembers, currentUserId],
  );

  const memberNameById = useMemo(() => {
    const map = new Map<Id<"users">, string>();
    groupMembers?.forEach((member) => map.set(member._id, member.name));
    return map;
  }, [groupMembers]);

  const mentionCandidates = useMemo<GroupMember[]>(
    () => (groupMembers ?? []).filter((member) => member._id !== currentUserId),
    [groupMembers, currentUserId],
  );

  const receiptFor = (message: ChatMessage): MessageReceipt | null => {
    if (isGroup || message.senderId !== currentUserId) {
      return null;
    }
    if (otherLastReadAt >= message.createdAt) {
      return "read";
    }
    if (otherLastSeen !== undefined && otherLastSeen >= message.createdAt) {
      return "delivered";
    }
    return "sent";
  };

  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(() => [...(results ?? [])].reverse(), [results]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  const latestIncomingAt =
    messages.length > 0 ? messages[messages.length - 1].createdAt : 0;
  useEffect(() => {
    if (latestIncomingAt > 0) {
      void markRead({ conversationId });
    }
  }, [conversationId, latestIncomingAt, markRead]);

  const replyLabel = (message: ChatMessage): string => {
    if (message.senderId === currentUserId) {
      return "You";
    }
    return message.senderName ?? otherUser?.name ?? "Unknown";
  };

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter((member) => member.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft(value);
    if (!isGroup) {
      return;
    }
    const caret = event.target.selectionStart ?? value.length;
    const match = value.slice(0, caret).match(MENTION_QUERY_REGEX);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (member: GroupMember) => {
    const textarea = composerRef.current;
    const caret = textarea?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const match = before.match(MENTION_QUERY_REGEX);
    if (!match) {
      return;
    }
    const lead = match[0].startsWith("@") ? "" : match[0][0];
    const start = before.length - match[0].length;
    const newBefore = `${before.slice(0, start)}${lead}@${member.name} `;
    setDraft(`${newBefore}${after}`);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(newBefore.length, newBefore.length);
    });
  };

  const computeMentions = (text: string): Id<"users">[] => {
    if (!isGroup || !groupMembers) {
      return [];
    }
    const ids: Id<"users">[] = [];
    for (const member of groupMembers) {
      if (member._id === currentUserId) {
        continue;
      }
      if (text.includes(`@${member.name}`)) {
        ids.push(member._id);
      }
    }
    return ids;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const mentions = computeMentions(text);

    try {
      await sendMessage({
        conversationId,
        text,
        replyToId: replyTarget?._id,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      setDraft("");
      setMentionQuery(null);
      setReplyTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (message: ChatMessage) => {
    setReplyTarget(message);
    composerRef.current?.focus();
  };

  const handleDelete = async (message: ChatMessage) => {
    try {
      await deleteMessage({ messageId: message._id });
      if (replyTarget?._id === message._id) {
        setReplyTarget(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  };

  const handleDownload = async (message: ChatMessage) => {
    if (!message.imageUrl) {
      return;
    }
    try {
      const response = await fetch(message.imageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `image-${message._id}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Failed to download image");
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || isUploadingImage) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };

      await sendMessage({ conversationId, imageStorageId: storageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <Fancybox>
      <div className="flex h-full min-h-0 flex-1">
        <div
          className={cn(
            "flex h-full min-h-0 flex-1 flex-col bg-[var(--background)]",
            showContactInfo && "hidden md:flex",
          )}
        >
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-[var(--card)] px-4">
            {onBack && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-foreground hover:bg-accent"
                onClick={onBack}
              >
                ←
              </Button>
            )}
            <button
              type="button"
              onClick={() => setShowContactInfo((value) => !value)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:opacity-90"
              aria-label="View contact info"
            >
              <UserAvatar
                name={conversation.title}
                imageUrl={conversation.avatarUrl}
                className="size-10"
                group={isGroup}
                online={isGroup ? undefined : presence === "online"}
                statusClassName="border-[var(--card)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{conversation.title}</p>
                {isGroup ? (
                  <p className="truncate text-xs text-foreground/50">
                    {groupSubtitle}
                  </p>
                ) : presence ? (
                  <p
                    className={cn(
                      "truncate text-xs",
                      presence === "online"
                        ? "text-[#00A884]"
                        : "text-foreground/50",
                    )}
                  >
                    {presence}
                  </p>
                ) : (
                  otherUser?.email && (
                    <p className="truncate text-xs text-foreground/50">
                      {otherUser.email}
                    </p>
                  )
                )}
              </div>
            </button>
            <ConversationActionsMenu
              conversation={conversation}
              align="end"
              side="bottom"
              triggerClassName="rounded-full p-2 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
              onDeleted={onDeleted}
            />
          </header>

          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          >
            {status === "CanLoadMore" && (
              <div className="mb-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent text-foreground hover:bg-accent"
                  onClick={() => loadMore(30)}
                >
                  Load older messages
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {messages.map((message, index) => {
                const previous = index > 0 ? messages[index - 1] : undefined;
                const showDaySeparator =
                  previous === undefined ||
                  new Date(previous.createdAt).toDateString() !==
                    new Date(message.createdAt).toDateString();

                return (
                  <div key={message._id} className="space-y-2">
                    {showDaySeparator && (
                      <DaySeparator
                        label={formatDaySeparator(message.createdAt)}
                      />
                    )}
                    {message.type === "system" ? (
                      <SystemMessage text={message.text ?? ""} />
                    ) : (
                      <MessageRow
                        message={message}
                        isOwn={message.senderId === currentUserId}
                        isGroup={isGroup}
                        canDelete={
                          message.senderId === currentUserId ||
                          (isGroup && iAmAdmin)
                        }
                        receipt={receiptFor(message)}
                        replyLabel={replyLabel(message)}
                        galleryId={`chat-${conversationId}`}
                        mentionNames={(message.mentions ?? [])
                          .map((id) => memberNameById.get(id))
                          .filter((name): name is string => name !== undefined)}
                        onReply={handleReply}
                        onForward={(msg) => setForwardMessage(msg)}
                        onDownload={(msg) => void handleDownload(msg)}
                        onDelete={(msg) => void handleDelete(msg)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>

          {isBlocked && otherUser ? (
            <BlockedComposer otherUserId={otherUser._id} />
          ) : (
            <footer className="border-t border-border bg-[var(--card)] px-4 py-3">
              {replyTarget && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--background)] px-3 py-2">
                  <div className="min-w-0 flex-1 border-l-2 border-[#00A884] pl-2">
                    <p className="text-xs font-medium text-[#00A884]">
                      {replyLabel(replyTarget)}
                    </p>
                    <p className="truncate text-sm text-foreground/60">
                      {replyTarget.type === "image"
                        ? "Photo"
                        : (replyTarget.text ?? "")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="rounded-full p-1 text-foreground/60 hover:bg-accent hover:text-foreground"
                    aria-label="Cancel reply"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <div className="relative flex items-end gap-2">
                {isGroup &&
                  mentionQuery !== null &&
                  mentionMatches.length > 0 && (
                    <div className="absolute bottom-full left-10 mb-2 max-h-56 w-64 overflow-y-auto rounded-lg bg-[var(--card)] py-1 shadow-2xl ring-1 ring-border">
                      {mentionMatches.map((member) => (
                        <button
                          key={member._id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertMention(member)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                        >
                          <UserAvatar
                            name={member.name}
                            imageUrl={member.profileImage}
                            className="size-8"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {member.name}
                          </span>
                          {member.role === "admin" && (
                            <ShieldCheck className="size-3.5 shrink-0 text-[#00A884]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage || isSending}
                  className="rounded-full p-2 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Attach image"
                >
                  {isUploadingImage ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleImageUpload(event)}
                />
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onBlur={() => setMentionQuery(null)}
                  placeholder="Type a message"
                  rows={1}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-lg bg-[var(--muted)] px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/40"
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && mentionQuery !== null) {
                      setMentionQuery(null);
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      if (mentionQuery !== null && mentionMatches.length > 0) {
                        event.preventDefault();
                        insertMention(mentionMatches[0]);
                        return;
                      }
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button
                  className="bg-[#00A884] text-white hover:bg-[#06cf9c]"
                  onClick={() => void handleSend()}
                  disabled={isSending || draft.trim().length === 0}
                >
                  Send
                </Button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}
            </footer>
          )}
        </div>

        {showContactInfo && (
          <ContactInfoPanel
            conversation={conversation}
            presence={presence}
            currentUserId={currentUserId}
            onClose={() => setShowContactInfo(false)}
          />
        )}

        {forwardMessage && (
          <ForwardDialog
            message={forwardMessage}
            currentConversationId={conversationId}
            onClose={() => setForwardMessage(null)}
          />
        )}
      </div>
    </Fancybox>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-lg bg-[var(--card)] px-3 py-1 text-xs font-medium text-foreground/60 shadow-sm">
        {label}
      </span>
    </div>
  );
}

function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="max-w-[85%] rounded-lg bg-[var(--card)] px-3 py-1.5 text-center text-xs text-foreground/70 shadow-sm">
        {text}
      </span>
    </div>
  );
}

function MessageReceiptTicks({ receipt }: { receipt: MessageReceipt }) {
  if (receipt === "sent") {
    return <Check className="size-3.5 text-foreground/50" />;
  }
  return (
    <CheckCheck
      className={cn(
        "size-3.5",
        receipt === "read" ? "text-[#53bdeb]" : "text-foreground/50",
      )}
    />
  );
}

function MessageRow({
  message,
  isOwn,
  isGroup,
  canDelete,
  receipt,
  replyLabel,
  galleryId,
  mentionNames,
  onReply,
  onForward,
  onDownload,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isGroup: boolean;
  canDelete: boolean;
  receipt: MessageReceipt | null;
  replyLabel: string;
  galleryId: string;
  mentionNames: string[];
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onDownload: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}) {
  const showSenderMeta = isGroup && !isOwn;
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      {showSenderMeta && (
        <UserAvatar
          name={message.senderName ?? "Unknown"}
          imageUrl={message.senderImage}
          className="size-8 self-end"
        />
      )}
      <div
        className={cn(
          "group/msg relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
          isOwn
            ? "rounded-tr-none bg-[var(--bubble-out)]"
            : "rounded-tl-none bg-[var(--card)]",
          message.type === "image" && "p-1",
        )}
      >
        <div className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Message options"
              className="rounded-md bg-black/40 p-0.5 text-white/90 transition-colors hover:bg-black/60"
            >
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? "end" : "start"} side="bottom">
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward(message)}>
                <Forward />
                Forward
              </DropdownMenuItem>
              {message.type === "image" && (
                <DropdownMenuItem onClick={() => onDownload(message)}>
                  <Download />
                  Download
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(message)}
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showSenderMeta && (
          <p className="mb-0.5 pr-5 text-xs font-medium text-[#53bdeb]">
            {message.senderName ?? "Unknown"}
          </p>
        )}

        {message.forwarded && (
          <p className="mb-0.5 flex items-center gap-1 text-xs italic text-foreground/40">
            <Forward className="size-3" />
            Forwarded
          </p>
        )}

        {message.replyTo && (
          <div
            className={cn(
              "mb-1 rounded border-l-2 border-[#00A884] bg-foreground/5 px-2 py-1 text-xs",
            )}
          >
            <p className="font-medium text-[#00A884]">{replyLabel}</p>
            <p className="truncate text-foreground/60">
              {message.replyTo.type === "image"
                ? "Photo"
                : (message.replyTo.text ?? "")}
            </p>
          </div>
        )}

        {message.type === "text" ? (
          <p className="whitespace-pre-wrap wrap-break-word pr-5 text-[15px] text-foreground">
            {renderTextWithMentions(message.text ?? "", mentionNames).map(
              (part, index) =>
                typeof part === "string" ? (
                  <span key={index}>{part}</span>
                ) : (
                  <span
                    key={index}
                    className="rounded bg-[#53bdeb]/15 font-medium text-[#53bdeb]"
                  >
                    {part.mention}
                  </span>
                ),
            )}
          </p>
        ) : (
          message.imageUrl && (
            <a
              href={message.imageUrl}
              data-fancybox={galleryId}
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt="Shared image"
                className="max-h-80 cursor-pointer rounded-md object-cover"
              />
            </a>
          )
        )}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[11px] text-foreground/50",
            isOwn ? "justify-end" : "justify-start",
          )}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          {receipt && <MessageReceiptTicks receipt={receipt} />}
        </div>
      </div>
    </div>
  );
}

function ForwardDialog({
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

function ContactInfoPanel({
  conversation,
  presence,
  currentUserId,
  onClose,
}: {
  conversation: ConversationPreview;
  presence: string;
  currentUserId: Id<"users">;
  onClose: () => void;
}) {
  const conversationId = conversation._id;
  const isGroup = conversation.kind === "group";
  const otherUser = conversation.otherUser;
  const images = useQuery(api.messages.listSharedImages, { conversationId });
  const groupMembers = useQuery(
    api.conversations.members,
    isGroup ? { conversationId } : "skip",
  );

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateGroup = useMutation(api.conversations.updateGroup);
  const addGroupMembers = useMutation(api.conversations.addGroupMembers);
  const removeGroupMember = useMutation(api.conversations.removeGroupMember);
  const setGroupAdmin = useMutation(api.conversations.setGroupAdmin);

  const iAmAdmin =
    groupMembers?.some(
      (member) => member._id === currentUserId && member.role === "admin",
    ) ?? false;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.title);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const existingMemberIds = groupMembers?.map((member) => member._id) ?? [];

  const handleSaveName = async () => {
    const name = nameDraft.trim();
    if (name.length === 0) {
      return;
    }
    try {
      await updateGroup({ conversationId, name });
      setIsEditingName(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to rename group",
      );
    }
  };

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setActionError("Please choose an image file");
      return;
    }
    setSavingImage(true);
    setActionError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error("Failed to upload image");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await updateGroup({ conversationId, imageStorageId: storageId });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update image",
      );
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-border bg-[var(--background)] md:w-[380px] md:shrink-0">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-[var(--card)] px-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close contact info"
        >
          <X className="size-5" />
        </button>
        <p className="font-medium">{isGroup ? "Group info" : "Contact info"}</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 bg-[var(--background)] px-6 py-8 text-center">
          <div className="relative">
            <UserAvatar
              name={conversation.title}
              imageUrl={conversation.avatarUrl}
              className="size-40"
              group={isGroup}
              online={isGroup ? undefined : presence === "online"}
              statusClassName="right-3 bottom-3 size-6 border-4 border-[var(--background)]"
            />
            {isGroup && iAmAdmin && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={savingImage}
                className="absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-[#00A884] text-white shadow-lg transition-colors hover:bg-[#06cf9c] disabled:opacity-60"
                aria-label="Change group image"
              >
                {savingImage ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleImageChange(event)}
            />
          </div>

          {isGroup && iAmAdmin && isEditingName ? (
            <div className="mt-2 flex w-full items-center gap-2">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                autoFocus
                className="min-w-0 flex-1 rounded-lg bg-[var(--card)] px-3 py-2 text-center text-lg text-foreground outline-none focus:ring-1 focus:ring-[#00A884]/50"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSaveName();
                  }
                  if (event.key === "Escape") {
                    setNameDraft(conversation.title);
                    setIsEditingName(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleSaveName()}
                className="rounded-full p-2 text-[#00A884] hover:bg-accent"
                aria-label="Save name"
              >
                <Check className="size-5" />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-medium text-foreground">
                {conversation.title}
              </h2>
              {isGroup && iAmAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(conversation.title);
                    setIsEditingName(true);
                  }}
                  className="rounded-full p-1.5 text-foreground/60 hover:bg-accent hover:text-foreground"
                  aria-label="Edit group name"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
          )}

          {isGroup ? (
            <p className="text-sm text-foreground/50">
              Group · {conversation.memberCount} members
            </p>
          ) : (
            <>
              {otherUser?.email && (
                <p className="text-sm text-foreground/50">{otherUser.email}</p>
              )}
              {presence && (
                <p
                  className={cn(
                    "text-sm",
                    presence === "online"
                      ? "text-[#00A884]"
                      : "text-foreground/50",
                  )}
                >
                  {presence}
                </p>
              )}
            </>
          )}
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
        </div>

        {isGroup && (
          <div className="mt-2 bg-[var(--background)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-foreground/60">
                {conversation.memberCount} members
              </p>
              {iAmAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddMembers(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[#00A884] transition-colors hover:bg-accent"
                >
                  <UserPlus className="size-4" />
                  Add
                </button>
              )}
            </div>
            {groupMembers === undefined ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-[#00A884]" />
              </div>
            ) : (
              <div className="space-y-1">
                {groupMembers.map((member) => {
                  const isSelf = member._id === currentUserId;
                  return (
                    <div
                      key={member._id}
                      className="group/member flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--card)]"
                    >
                      <UserAvatar
                        name={member.name}
                        imageUrl={member.profileImage}
                        className="size-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {isSelf ? "You" : member.name}
                        </p>
                        {member.email && (
                          <p className="truncate text-sm text-foreground/50">
                            {member.email}
                          </p>
                        )}
                      </div>
                      {member.role === "admin" && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#00A884]/15 px-2 py-0.5 text-xs font-medium text-[#00A884]">
                          <ShieldCheck className="size-3" />
                          Admin
                        </span>
                      )}
                      {iAmAdmin && !isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Manage ${member.name}`}
                            className="rounded-full p-1.5 text-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/member:opacity-100 focus:opacity-100"
                          >
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom">
                            <DropdownMenuItem
                              onClick={() =>
                                void setGroupAdmin({
                                  conversationId,
                                  memberId: member._id,
                                  isAdmin: member.role !== "admin",
                                }).catch((err: unknown) =>
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to update admin",
                                  ),
                                )
                              }
                            >
                              {member.role === "admin" ? <Shield /> : <Crown />}
                              {member.role === "admin"
                                ? "Dismiss as admin"
                                : "Make admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                void removeGroupMember({
                                  conversationId,
                                  memberId: member._id,
                                }).catch((err: unknown) =>
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to remove member",
                                  ),
                                )
                              }
                            >
                              <UserMinus />
                              Remove from group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 bg-[var(--background)] px-4 py-4">
          <p className="mb-3 text-sm text-foreground/60">Shared media</p>
          {images === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : images.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/40">
              No media shared yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {images.map((image) => (
                <a
                  key={image._id}
                  href={image.imageUrl}
                  data-fancybox={`media-${conversationId}`}
                  className="aspect-square cursor-pointer overflow-hidden rounded-md bg-[var(--card)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.imageUrl}
                    alt="Shared media"
                    className="size-full object-cover transition-transform hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddMembers && (
        <AddMembersDialog
          existingMemberIds={existingMemberIds}
          onClose={() => setShowAddMembers(false)}
          onAdd={async (memberIds) => {
            try {
              await addGroupMembers({ conversationId, memberIds });
              setShowAddMembers(false);
            } catch (err) {
              setActionError(
                err instanceof Error ? err.message : "Failed to add members",
              );
              setShowAddMembers(false);
            }
          }}
        />
      )}
    </aside>
  );
}

function AddMembersDialog({
  existingMemberIds,
  onClose,
  onAdd,
}: {
  existingMemberIds: Id<"users">[];
  onClose: () => void;
  onAdd: (memberIds: Id<"users">[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const results = useQuery(
    api.users.search,
    debouncedQuery.length > 0 ? { query: debouncedQuery } : "skip",
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const existing = new Set(existingMemberIds);

  const toggleUser = (user: PublicUser) => {
    setSelected((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user],
    );
  };

  const handleAdd = async () => {
    if (selected.length === 0) {
      return;
    }
    setIsAdding(true);
    await onAdd(selected.map((u) => u._id));
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-[var(--background)] shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium">Add members</h2>
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
              placeholder="Search users by name or email"
              autoFocus
              className="w-full rounded-lg bg-[var(--card)] py-2.5 pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {query.trim().length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              Search for people to add.
            </p>
          ) : results === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : results.filter((u) => !existing.has(u._id)).length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground/50">
              No users found.
            </p>
          ) : (
            results
              .filter((u) => !existing.has(u._id))
              .map((user) => {
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
          <p className="text-sm text-foreground/40">
            {selected.length} selected
          </p>
          <Button
            className="bg-[#00A884] text-white hover:bg-[#06cf9c]"
            onClick={() => void handleAdd()}
            disabled={isAdding || selected.length === 0}
          >
            {isAdding ? <Loader2 className="size-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlockedComposer({ otherUserId }: { otherUserId: Id<"users"> }) {
  const setBlocked = useMutation(api.conversations.setBlocked);

  return (
    <footer className="flex flex-col items-center gap-2 border-t border-border bg-[var(--card)] px-4 py-4 text-center">
      <p className="text-sm text-foreground/60">
        You blocked this contact. Unblock them to send messages.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="text-[#00A884] hover:bg-[#00A884]/10 hover:text-[#06cf9c]"
        onClick={() => void setBlocked({ otherUserId, blocked: false })}
      >
        Unblock
      </Button>
    </footer>
  );
}
