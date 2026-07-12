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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Camera,
  Check,
  Crown,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ConversationPreview, PublicUser } from "./types";

export function ContactInfoPanel({
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
