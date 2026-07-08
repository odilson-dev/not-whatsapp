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
});
