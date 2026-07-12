"use client";

import { Fancybox } from "@/components/chat/Fancybox";
import {
  ConversationActionsMenu,
} from "@/components/chat/ConversationList";
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
import { formatMessageTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  Forward,
  Loader2,
  Reply,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ForwardDialog } from "./ForwardDialog";
import { ContactInfoPanel } from "./ContactInfoPanel";
import {
  MENTION_QUERY_REGEX,
  formatDaySeparator,
  presenceLabel,
  renderTextWithMentions,
  useNow,
} from "./chat-utils";
import type {
  ChatMessage,
  ConversationPreview,
  GroupMember,
  MessageReceipt,
} from "./types";

export function MessagePanel({
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
