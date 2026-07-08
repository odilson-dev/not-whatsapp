"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { formatConversationTime, formatMessageTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  Camera,
  Loader2,
  MessageSquare,
  MoreVertical,
  Search,
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
};

export function ChatPage() {
  const currentUser = useQuery(api.users.me);
  const conversations = useQuery(api.conversations.list);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);

  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
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

  const filteredConversations = useMemo(() => {
    if (!conversations) {
      return [];
    }

    const term = sidebarSearch.trim().toLowerCase();
    if (!term) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.otherUser.name.toLowerCase().includes(term),
    );
  }, [conversations, sidebarSearch]);

  const selectedConversation = conversations?.find(
    (conversation) => conversation._id === selectedConversationId,
  );

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
      setSelectedConversationId(conversationId);
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

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-white/50">
              {conversations.length === 0
                ? "No chats yet. Start a new conversation."
                : "No chats match your search."}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation._id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation._id}
                onSelect={() => setSelectedConversationId(conversation._id)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="hidden min-w-0 flex-1 md:flex">
        {selectedConversation ? (
          <MessagePanel
            conversationId={selectedConversation._id}
            currentUserId={currentUser._id}
            otherUser={selectedConversation.otherUser}
          />
        ) : (
          <EmptyChatState />
        )}
      </section>

      {selectedConversation && (
        <section className="flex min-w-0 flex-1 md:hidden">
          <MessagePanel
            conversationId={selectedConversation._id}
            currentUserId={currentUser._id}
            otherUser={selectedConversation.otherUser}
            onBack={() => setSelectedConversationId(null)}
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#202c33]",
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
          <p className="truncate font-medium text-white">
            {conversation.otherUser.name}
          </p>
          <span className="shrink-0 text-xs text-white/45">
            {formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-white/50">
          {conversation.lastMessageType === "image" && (
            <Camera className="size-3.5 shrink-0" />
          )}
          <p className="truncate">
            {conversation.lastMessagePreview ?? "No messages yet"}
          </p>
        </div>
      </div>
    </button>
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
  conversationId,
  currentUserId,
  otherUser,
  onBack,
}: {
  conversationId: Id<"conversations">;
  currentUserId: Id<"users">;
  otherUser: ConversationPreview["otherUser"];
  onBack?: () => void;
}) {
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { conversationId },
    { initialNumItems: 50 },
  );

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(() => [...(results ?? [])].reverse(), [results]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await sendMessage({ conversationId, text });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#0b141a]">
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
        <UserAvatar
          name={otherUser.name}
          imageUrl={otherUser.profileImage}
          className="size-10"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{otherUser.name}</p>
          {otherUser.email && (
            <p className="truncate text-xs text-white/50">{otherUser.email}</p>
          )}
        </div>
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
          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;

            return (
              <div
                key={message._id}
                className={cn("flex", isOwn ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                    isOwn
                      ? "rounded-tr-none bg-[#005c4b]"
                      : "rounded-tl-none bg-[#202c33]",
                    message.type === "image" && "p-1",
                  )}
                >
                  {message.type === "text" ? (
                    <p className="whitespace-pre-wrap break-words text-[15px] text-white">
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
                  <p
                    className={cn(
                      "mt-1 text-[11px] text-white/50",
                      isOwn ? "text-right" : "text-left",
                    )}
                  >
                    {formatMessageTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-white/10 bg-[#202c33] px-4 py-3">
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
    </div>
  );
}
