import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
});
