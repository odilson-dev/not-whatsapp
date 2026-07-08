import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const messageTypeValidator = v.union(v.literal("text"), v.literal("image"));

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    createdAt: v.string(),
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    profileImage: v.optional(v.string()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("user_id", ["userId"])
    .index("name", ["name"])
    .index("email", ["email"]),

  conversations: defineTable({
    memberOneId: v.id("users"),
    memberTwoId: v.id("users"),
    lastMessageAt: v.number(),
    lastMessagePreview: v.optional(v.string()),
    lastMessageType: v.optional(messageTypeValidator),
  })
    .index("by_members", ["memberOneId", "memberTwoId"])
    .index("by_member_one", ["memberOneId", "lastMessageAt"])
    .index("by_member_two", ["memberTwoId", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    type: messageTypeValidator,
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
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
});
