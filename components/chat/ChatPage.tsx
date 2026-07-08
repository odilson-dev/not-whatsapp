"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatConversationTime,
  formatLastSeen,
  formatMessageTime,
} from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  Download,
  Forward,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pin,
  PinOff,
  Reply,
  Search,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ConversationPreview = {
  _id: Id<"conversations">;
  lastMessageAt: number;
  lastMessagePreview?: string;
  lastMessageType?: "text" | "image";
  otherUser: {
    _id: Id<"users">;
    name: string;
    email?: string;
    profileImage?: string;
  };
  isArchived: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  unread: boolean;
  isBlocked: boolean;
};

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
  type: "text" | "image";
  text?: string;
  imageUrl?: string;
  createdAt: number;
  forwarded?: boolean;
  replyTo?: {
    messageId: Id<"messages">;
    senderId: Id<"users">;
    type: "text" | "image";
    text?: string;
  };
};

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

  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState("");
  const [debouncedNewChatQuery, setDebouncedNewChatQuery] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);

  const searchResults = useQuery(
    api.users.search,
    debouncedNewChatQuery.length > 0 ? { query: debouncedNewChatQuery } : "skip",
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedNewChatQuery(newChatQuery);
    }, 250);

    return () => clearTimeout(timeout);
  }, [newChatQuery]);

  const archivedCount = useMemo(
    () =>
      conversations?.filter((conversation) => conversation.isArchived).length ??
      0,
    [conversations],
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
      if (!term) {
        return true;
      }
      return conversation.otherUser.name.toLowerCase().includes(term);
    });
  }, [conversations, sidebarSearch, showArchived]);

  const selectedConversation = conversations?.find(
    (conversation) => conversation._id === selectedConversationId,
  );

  const handleSelectConversation = (conversationId: Id<"conversations">) => {
    setSelectedConversationId(conversationId);
    void markRead({ conversationId });
  };

  useEffect(() => {
    if (
      selectedConversationId &&
      conversations &&
      !conversations.some(
        (conversation) => conversation._id === selectedConversationId,
      )
    ) {
      setSelectedConversationId(null);
    }
  }, [conversations, selectedConversationId]);

  const startChatWithUser = async (otherUserId: Id<"users">) => {
    setIsStartingChat(true);
    try {
      const conversationId = await getOrCreateConversation({ otherUserId });
      setShowArchived(false);
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
      <div className="flex min-h-screen items-center justify-center bg-[#111B21] text-white">
        <Loader2 className="size-8 animate-spin text-[#00A884]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#111B21] text-white">
      <aside
        className={cn(
          "flex w-full flex-col border-r border-white/10 bg-[#111B21] md:w-[420px] md:max-w-[40%]",
          selectedConversationId && "hidden md:flex",
        )}
      >
        <header className="flex items-center justify-between px-4 py-3">
          <UserAvatar
            name={currentUser.name}
            imageUrl={currentUser.profileImage}
            className="size-10"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="New chat"
            >
              <MessageSquare className="size-5" />
            </button>
            <Link
              href="/profile"
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Profile"
            >
              <MoreVertical className="size-5" />
            </Link>
          </div>
        </header>

        <div className="px-3 pb-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={sidebarSearch}
              onChange={(event) => setSidebarSearch(event.target.value)}
              placeholder="Search"
              className="w-full rounded-lg bg-[#202c33] py-2 pr-3 pl-10 text-sm text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        {showArchived && (
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className="flex items-center gap-3 border-b border-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-[#202c33]"
          >
            <ArrowLeft className="size-4" />
            <span className="font-medium">Archived</span>
          </button>
        )}

        {!showArchived && archivedCount > 0 && sidebarSearch.trim() === "" && (
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-[#202c33]"
          >
            <Archive className="size-4 text-[#00A884]" />
            <span className="font-medium">Archived</span>
            <span className="ml-auto text-xs text-white/45">
              {archivedCount}
            </span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-white/50">
              {showArchived
                ? "No archived chats."
                : conversations.length === 0
                  ? "No chats yet. Start a new conversation."
                  : "No chats match your search."}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation._id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation._id}
                onSelect={() => handleSelectConversation(conversation._id)}
              />
            ))
          )}
        </div>
      </aside>

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

      {selectedConversation && (
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
    </div>
  );
}

function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ConversationPreview;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
        "group/row flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#202c33]",
        isSelected && "bg-[#2a3942]",
      )}
    >
      <UserAvatar
        name={conversation.otherUser.name}
        imageUrl={conversation.otherUser.profileImage}
        className="size-12"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate font-medium text-white",
              conversation.unread && "font-semibold",
            )}
          >
            {conversation.otherUser.name}
          </p>
          <span
            className={cn(
              "shrink-0 text-xs text-white/45",
              conversation.unread && "text-[#00A884]",
            )}
          >
            {formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-white/50">
          {conversation.lastMessageType === "image" && (
            <Camera className="size-3.5 shrink-0" />
          )}
          <p
            className={cn(
              "truncate",
              conversation.unread && "font-medium text-white/80",
            )}
          >
            {conversation.lastMessagePreview ?? "No messages yet"}
          </p>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {conversation.isBlocked && (
              <Ban className="size-3.5 text-red-400/70" />
            )}
            {conversation.isFavorite && (
              <Star className="size-3.5 fill-[#00A884] text-[#00A884]" />
            )}
            {conversation.isPinned && (
              <Pin className="size-3.5 text-white/45" />
            )}
            {conversation.unread && (
              <span className="size-2.5 rounded-full bg-[#00A884]" />
            )}
          </span>
        </div>
      </div>

      <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
        <ConversationActionsMenu
          conversation={conversation}
          align="start"
          side="bottom"
          triggerClassName="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        />
      </div>
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

  const conversationId = conversation._id;

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
            ? "Remove from favourites"
            : "Add to favourites"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            void setBlocked({
              otherUserId: conversation.otherUser._id,
              blocked: !conversation.isBlocked,
            })
          }
        >
          <Ban />
          {conversation.isBlocked ? "Unblock" : "Block"}
        </DropdownMenuItem>
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
    <div className="flex flex-1 flex-col items-center justify-center bg-[#222e35] text-center">
      <div className="mb-6 rounded-full bg-[#202c33] p-8">
        <MessageSquare className="size-16 text-white/20" />
      </div>
      <h2 className="text-2xl font-light text-white/90">Not Whatsapp Web</h2>
      <p className="mt-3 max-w-sm text-sm text-white/50">
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
  results: ConversationPreview["otherUser"][] | undefined;
  isLoading: boolean;
  onClose: () => void;
  onSelectUser: (userId: Id<"users">) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[#111B21] shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-medium">New chat</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/70 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search users by name or email"
              autoFocus
              className="w-full rounded-lg bg-[#202c33] py-2.5 pr-3 pl-10 text-sm text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto border-t border-white/10">
          {query.trim().length === 0 ? (
            <p className="px-4 py-6 text-sm text-white/50">
              Type to find someone to chat with.
            </p>
          ) : results === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-white/50">No users found.</p>
          ) : (
            results.map((user) => (
              <button
                key={user._id}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectUser(user._id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#202c33] disabled:opacity-60"
              >
                <UserAvatar
                  name={user.name}
                  imageUrl={user.profileImage}
                  className="size-10"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  {user.email && (
                    <p className="truncate text-sm text-white/50">
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
  const otherUser = conversation.otherUser;
  const isBlocked = conversation.isBlocked;
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const markRead = useMutation(api.conversations.markRead);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const otherStatus = useQuery(api.conversations.otherMemberStatus, {
    conversationId,
  });
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { conversationId },
    { initialNumItems: 50 },
  );

  const now = useNow(30000);
  const otherLastReadAt = otherStatus?.lastReadAt ?? 0;
  const otherLastSeen = otherStatus?.lastSeen;
  const presence = presenceLabel(otherLastSeen, now);

  const receiptFor = (message: ChatMessage): MessageReceipt | null => {
    if (message.senderId !== currentUserId) {
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

  const latestIncomingAt = messages.length > 0 ? messages[messages.length - 1].createdAt : 0;
  useEffect(() => {
    if (latestIncomingAt > 0) {
      void markRead({ conversationId });
    }
  }, [conversationId, latestIncomingAt, markRead]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await sendMessage({
        conversationId,
        text,
        replyToId: replyTarget?._id,
      });
      setDraft("");
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
    <div className="flex h-full min-h-0 flex-1">
      <div
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col bg-[#0b141a]",
          showContactInfo && "hidden md:flex",
        )}
      >
        <header className="flex items-center gap-3 border-b border-white/10 bg-[#202c33] px-4 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10"
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
            name={otherUser.name}
            imageUrl={otherUser.profileImage}
            className="size-10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{otherUser.name}</p>
            {presence ? (
              <p
                className={cn(
                  "truncate text-xs",
                  presence === "online" ? "text-[#00A884]" : "text-white/50",
                )}
              >
                {presence}
              </p>
            ) : (
              otherUser.email && (
                <p className="truncate text-xs text-white/50">
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
          triggerClassName="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
              className="border-white/10 bg-transparent text-white hover:bg-white/5"
              onClick={() => loadMore(30)}
            >
              Load older messages
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {messages.map((message) => (
            <MessageRow
              key={message._id}
              message={message}
              isOwn={message.senderId === currentUserId}
              receipt={receiptFor(message)}
              currentUserId={currentUserId}
              otherUserName={otherUser.name}
              onReply={handleReply}
              onForward={(msg) => setForwardMessage(msg)}
              onDownload={(msg) => void handleDownload(msg)}
              onDelete={(msg) => void handleDelete(msg)}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {isBlocked ? (
        <BlockedComposer otherUserId={otherUser._id} />
      ) : (
        <footer className="border-t border-white/10 bg-[#202c33] px-4 py-3">
        {replyTarget && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#111B21] px-3 py-2">
            <div className="min-w-0 flex-1 border-l-2 border-[#00A884] pl-2">
              <p className="text-xs font-medium text-[#00A884]">
                {replyTarget.senderId === currentUserId
                  ? "You"
                  : otherUser.name}
              </p>
              <p className="truncate text-sm text-white/60">
                {replyTarget.type === "image"
                  ? "Photo"
                  : (replyTarget.text ?? "")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Cancel reply"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage || isSending}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
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
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg bg-[#2a3942] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-[#00A884]/40"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
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
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        </footer>
      )}
      </div>

      {showContactInfo && (
        <ContactInfoPanel
          conversationId={conversationId}
          otherUser={otherUser}
          presence={presence}
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
  );
}

function MessageReceiptTicks({ receipt }: { receipt: MessageReceipt }) {
  if (receipt === "sent") {
    return <Check className="size-3.5 text-white/50" />;
  }
  return (
    <CheckCheck
      className={cn(
        "size-3.5",
        receipt === "read" ? "text-[#53bdeb]" : "text-white/50",
      )}
    />
  );
}

function MessageRow({
  message,
  isOwn,
  receipt,
  currentUserId,
  otherUserName,
  onReply,
  onForward,
  onDownload,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  receipt: MessageReceipt | null;
  currentUserId: Id<"users">;
  otherUserName: string;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onDownload: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "group/msg relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
          isOwn
            ? "rounded-tr-none bg-[#005c4b]"
            : "rounded-tl-none bg-[#202c33]",
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(message)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {message.forwarded && (
          <p className="mb-0.5 flex items-center gap-1 text-xs italic text-white/40">
            <Forward className="size-3" />
            Forwarded
          </p>
        )}

        {message.replyTo && (
          <div
            className={cn(
              "mb-1 rounded border-l-2 border-[#00A884] px-2 py-1 text-xs",
              isOwn ? "bg-black/20" : "bg-black/25",
            )}
          >
            <p className="font-medium text-[#00A884]">
              {message.replyTo.senderId === currentUserId
                ? "You"
                : otherUserName}
            </p>
            <p className="truncate text-white/60">
              {message.replyTo.type === "image"
                ? "Photo"
                : (message.replyTo.text ?? "")}
            </p>
          </div>
        )}

        {message.type === "text" ? (
          <p className="whitespace-pre-wrap break-words pr-5 text-[15px] text-white">
            {message.text}
          </p>
        ) : (
          message.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt="Shared image"
              className="max-h-80 rounded-md object-cover"
            />
          )
        )}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[11px] text-white/50",
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
      return conversation.otherUser.name.toLowerCase().includes(term);
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
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[#111B21] shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-medium text-white">Forward message to</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/70 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              autoFocus
              className="w-full rounded-lg bg-[#202c33] py-2.5 pr-3 pl-10 text-sm text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-[#00A884]/50"
            />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto border-t border-white/10">
          {conversations === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : targets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-white/50">No chats found.</p>
          ) : (
            targets.map((conversation) => (
              <button
                key={conversation._id}
                type="button"
                disabled={forwardingTo !== null}
                onClick={() => void handleForward(conversation._id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#202c33] disabled:opacity-60"
              >
                <UserAvatar
                  name={conversation.otherUser.name}
                  imageUrl={conversation.otherUser.profileImage}
                  className="size-10"
                />
                <p className="min-w-0 flex-1 truncate font-medium text-white">
                  {conversation.otherUser.name}
                </p>
                {forwardingTo === conversation._id && (
                  <Loader2 className="size-4 animate-spin text-[#00A884]" />
                )}
              </button>
            ))
          )}
        </div>
        {error && <p className="px-4 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

function ContactInfoPanel({
  conversationId,
  otherUser,
  presence,
  onClose,
}: {
  conversationId: Id<"conversations">;
  otherUser: ConversationPreview["otherUser"];
  presence: string;
  onClose: () => void;
}) {
  const images = useQuery(api.messages.listSharedImages, { conversationId });

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-white/10 bg-[#111B21] md:w-[380px] md:shrink-0">
      <header className="flex items-center gap-4 border-b border-white/10 bg-[#202c33] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close contact info"
        >
          <X className="size-5" />
        </button>
        <p className="font-medium">Contact info</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 bg-[#111B21] px-6 py-8 text-center">
          <UserAvatar
            name={otherUser.name}
            imageUrl={otherUser.profileImage}
            className="size-40"
          />
          <h2 className="mt-2 text-xl font-medium text-white">
            {otherUser.name}
          </h2>
          {otherUser.email && (
            <p className="text-sm text-white/50">{otherUser.email}</p>
          )}
          {presence && (
            <p
              className={cn(
                "text-sm",
                presence === "online" ? "text-[#00A884]" : "text-white/50",
              )}
            >
              {presence}
            </p>
          )}
        </div>

        <div className="mt-2 bg-[#111B21] px-4 py-4">
          <p className="mb-3 text-sm text-white/60">Shared media</p>
          {images === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#00A884]" />
            </div>
          ) : images.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">
              No media shared yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {images.map((image) => (
                <a
                  key={image._id}
                  href={image.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-md bg-[#202c33]"
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
    </aside>
  );
}

function BlockedComposer({ otherUserId }: { otherUserId: Id<"users"> }) {
  const setBlocked = useMutation(api.conversations.setBlocked);

  return (
    <footer className="flex flex-col items-center gap-2 border-t border-white/10 bg-[#202c33] px-4 py-4 text-center">
      <p className="text-sm text-white/60">
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
