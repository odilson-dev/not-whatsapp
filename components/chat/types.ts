import type { Id } from "@/convex/_generated/dataModel";

export type PublicUser = {
  _id: Id<"users">;
  name: string;
  email?: string;
  profileImage?: string;
  lastSeen?: number;
};

export type GroupMember = PublicUser & { role: "admin" | "member" };

export type ConversationPreview = {
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

export type FilterKey = "all" | "unread" | "favorites" | "groups";

export type MessageReceipt = "sent" | "delivered" | "read";

export type ChatMessage = {
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

export const ONLINE_THRESHOLD_MS = 60_000;
