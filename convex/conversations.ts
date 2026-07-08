import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { getOtherMemberId, sortMemberIds } from "./lib/conversations";

const publicUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
});

const conversationPreviewValidator = v.object({
  _id: v.id("conversations"),
  lastMessageAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  lastMessageType: v.optional(v.union(v.literal("text"), v.literal("image"))),
  otherUser: publicUserValidator,
});

export const list = query({
  args: {},
  returns: v.array(conversationPreviewValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const asMemberOne = await ctx.db
      .query("conversations")
      .withIndex("by_member_one", (q) => q.eq("memberOneId", user._id))
      .order("desc")
      .collect();

    const asMemberTwo = await ctx.db
      .query("conversations")
      .withIndex("by_member_two", (q) => q.eq("memberTwoId", user._id))
      .order("desc")
      .collect();

    const conversations = [...asMemberOne, ...asMemberTwo].sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt,
    );

    const previews = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUserId = getOtherMemberId(conversation, user._id);
        const otherUser = await ctx.db.get("users", otherUserId);

        if (!otherUser) {
          return null;
        }

        return {
          _id: conversation._id,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageType: conversation.lastMessageType,
          otherUser: {
            _id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email,
            profileImage: otherUser.profileImage,
          },
        };
      }),
    );

    return previews.filter(
      (preview): preview is NonNullable<typeof preview> => preview !== null,
    );
  },
});

export const getOrCreate = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (args.otherUserId === user._id) {
      throw new Error("Cannot start a chat with yourself");
    }

    const otherUser = await ctx.db.get("users", args.otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    const [memberOneId, memberTwoId] = sortMemberIds(user._id, args.otherUserId);

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_members", (q) =>
        q.eq("memberOneId", memberOneId).eq("memberTwoId", memberTwoId),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conversations", {
      memberOneId,
      memberTwoId,
      lastMessageAt: Date.now(),
    });
  },
});
