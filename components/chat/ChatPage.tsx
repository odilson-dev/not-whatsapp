"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Modal } from "@/components/admin/Modal";
import { SIGN_IN_PATH } from "@/components/auth/auth-utils";
import { MediaView } from "@/components/chat/MediaView";
import { NavRail, type ChatSection } from "@/components/chat/NavRail";
import { SettingsView } from "@/components/chat/SettingsView";
import { StatusView } from "@/components/chat/StatusView";
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
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  ListChecks,
  Loader2,
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ConversationListItem,
  EmptyChatState,
  FilterChip,
} from "./ConversationList";
import { MessagePanel } from "./MessagePanel";
import { NewChatDialog } from "./NewChatDialog";
import { NewGroupDialog } from "./NewGroupDialog";
import { useNow } from "./chat-utils";
import { ONLINE_THRESHOLD_MS, type FilterKey } from "./types";

/** Main chat shell: sidebar, message panel, and section routing (status, media, settings). */
export function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const authArgs = isAuthenticated ? {} : "skip";

  // `users.me` returns null until StoreUserInDatabase inserts the row.
  // Other queries call getCurrentUser and throw if the row is missing —
  // wait for the profile before subscribing.
  const currentUser = useQuery(api.users.me, authArgs);
  const readyArgs = currentUser ? {} : "skip";

  const conversations = useQuery(api.conversations.list, readyArgs);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const markRead = useMutation(api.conversations.markRead);
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(SIGN_IN_PATH);
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

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
  }, [heartbeat, currentUser]);

  const now = useNow(30000);
  const { signOut } = useClerk();
  const removeConversation = useMutation(api.conversations.remove);
  const [activeSection, setActiveSection] = useState<ChatSection>("chats");
  const statusOverview = useQuery(
    api.status.listActive,
    currentUser ? { now } : "skip",
  );
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
    currentUser && debouncedNewChatQuery.length > 0
      ? { query: debouncedNewChatQuery }
      : "skip",
  );

  const onlineUsers = useQuery(
    api.users.listOnline,
    currentUser && showNewChat ? { now } : "skip",
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

  if (
    isAuthLoading ||
    !isAuthenticated ||
    currentUser === undefined ||
    currentUser === null ||
    conversations === undefined
  ) {
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
          activeSection === "chats" && openConversationId && "hidden md:flex",
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
                  className="rounded-full cursor-pointer p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="New chat"
                >
                  <MessageSquarePlus className="size-5" />
                </button>
                <ThemeToggle
                  bare
                  className="rounded-full cursor-pointer p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Menu"
                    className="rounded-full cursor-pointer p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
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
                      onClick={() =>
                        void signOut({ redirectUrl: SIGN_IN_PATH })
                      }
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
                    !selectionMode && openConversationId === conversation._id
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
            <EmptyChatState onNewChat={() => setShowNewChat(true)} />
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
          onlineUsers={onlineUsers}
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
