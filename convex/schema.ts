import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Types that a user can actually author and that show up as a conversation
// preview. System messages are never used as a preview type.
const previewMessageTypeValidator = v.union(
  v.literal("text"),
  v.literal("image"),
);

// All message types, including admin/membership "system" events.
const messageTypeValidator = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("system"),
);

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    createdAt: v.string(),
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    profileImage: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
    // Platform-wide role. Treated as "user" when missing.
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    // Moderation state. A banned user is blocked from sending messages and
    // creating conversations, and is shown a lockout screen in the app.
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    banReason: v.optional(v.string()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("user_id", ["userId"])
    .index("name", ["name"])
    .index("email", ["email"])
    .index("by_role", ["role"]),

  conversations: defineTable({
    // "direct" (1:1) or "group". Treated as "direct" when missing (legacy rows).
    kind: v.optional(v.union(v.literal("direct"), v.literal("group"))),
    // Group metadata (only set for groups).
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    // Only set for direct conversations; used for 1:1 dedup.
    memberOneId: v.optional(v.id("users")),
    memberTwoId: v.optional(v.id("users")),
    lastMessageAt: v.number(),
    lastMessagePreview: v.optional(v.string()),
    lastMessageType: v.optional(previewMessageTypeValidator),
  })
    .index("by_members", ["memberOneId", "memberTwoId"]),

  // Membership rows for both direct and group conversations. This is the
  // source of truth for who belongs to a conversation.
  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    // Group role. Treated as "member" when missing.
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_user", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    type: messageTypeValidator,
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    forwarded: v.optional(v.boolean()),
    // User ids mentioned (@tagged) in this message.
    mentions: v.optional(v.array(v.id("users"))),
    // Denormalized snapshot of the message being replied to, so the reply
    // still renders even if the original is later deleted.
    replyTo: v.optional(
      v.object({
        messageId: v.id("messages"),
        senderId: v.id("users"),
        type: messageTypeValidator,
        text: v.optional(v.string()),
      }),
    ),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  // Per-user state for a conversation (archive/pin/favorite/read status,
  // and per-user "delete chat"). A conversation is a shared row between two
  // users, so this state must be scoped to each user individually.
  conversationStates: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    isArchived: v.boolean(),
    isPinned: v.boolean(),
    isFavorite: v.boolean(),
    manualUnread: v.boolean(),
    lastReadAt: v.number(),
    pinnedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_and_conversation", ["userId", "conversationId"])
    .index("by_user", ["userId"]),

  // User-to-user block relationships (independent of any conversation).
  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
  })
    .index("by_blocker_and_blocked", ["blockerId", "blockedId"])
    .index("by_blocker", ["blockerId"])
    .index("by_blocked", ["blockedId"]),

  // Ephemeral "status" updates (WhatsApp-style). Each row expires 24h after
  // it is created; expired rows are simply filtered out of queries.
  statuses: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("text"), v.literal("image")),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Background color for text statuses (hex string).
    backgroundColor: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Tracks which statuses a viewer has seen (for the seen/unseen ring).
  statusViews: defineTable({
    statusId: v.id("statuses"),
    viewerId: v.id("users"),
    viewedAt: v.number(),
  })
    .index("by_status_and_viewer", ["statusId", "viewerId"])
    .index("by_viewer", ["viewerId"]),
});
