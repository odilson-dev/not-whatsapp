import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getBlockRecord } from "./lib/blocks";
import { getCurrentUser } from "./lib/auth";
import {
  getConversationState,
  upsertConversationState,
} from "./lib/conversationStates";
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
  isArchived: v.boolean(),
  isPinned: v.boolean(),
  isFavorite: v.boolean(),
  unread: v.boolean(),
  isBlocked: v.boolean(),
});

async function assertConversationMember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const conversation = await ctx.db.get("conversations", conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (
    conversation.memberOneId !== userId &&
    conversation.memberTwoId !== userId
  ) {
    throw new Error("Unauthorized");
  }

  return conversation;
}

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

    const conversations = [...asMemberOne, ...asMemberTwo];

    const previews = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUserId = getOtherMemberId(conversation, user._id);
        const otherUser = await ctx.db.get("users", otherUserId);

        if (!otherUser) {
          return null;
        }

        const state = await getConversationState(
          ctx,
          user._id,
          conversation._id,
        );

        // Per-user "delete chat" hides the conversation until a newer
        // message arrives (matching WhatsApp behaviour).
        if (
          state?.deletedAt !== undefined &&
          state.deletedAt >= conversation.lastMessageAt
        ) {
          return null;
        }

        const iBlocked = await getBlockRecord(ctx, user._id, otherUserId);

        const lastReadAt = state?.lastReadAt ?? 0;
        const hasMessage = conversation.lastMessagePreview !== undefined;
        const unread =
          state?.manualUnread === true ||
          (hasMessage && conversation.lastMessageAt > lastReadAt);

        return {
          pinnedAt: state?.pinnedAt ?? 0,
          preview: {
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
            isArchived: state?.isArchived ?? false,
            isPinned: state?.isPinned ?? false,
            isFavorite: state?.isFavorite ?? false,
            unread,
            isBlocked: iBlocked !== null,
          },
        };
      }),
    );

    const filtered = previews.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    // Pinned conversations float to the top (most recently pinned first),
    // everything else sorts by most recent activity.
    filtered.sort((a, b) => {
      if (a.preview.isPinned !== b.preview.isPinned) {
        return a.preview.isPinned ? -1 : 1;
      }
      if (a.preview.isPinned && b.preview.isPinned) {
        return b.pinnedAt - a.pinnedAt;
      }
      return b.preview.lastMessageAt - a.preview.lastMessageAt;
    });

    return filtered.map((item) => item.preview);
  },
});

export const otherMemberStatus = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.object({
    otherUserId: v.id("users"),
    lastReadAt: v.number(),
    lastSeen: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await assertConversationMember(
      ctx,
      args.conversationId,
      user._id,
    );

    const otherUserId = getOtherMemberId(conversation, user._id);
    const otherUser = await ctx.db.get("users", otherUserId);

    const otherState = await getConversationState(
      ctx,
      otherUserId,
      args.conversationId,
    );

    return {
      otherUserId,
      lastReadAt: otherState?.lastReadAt ?? 0,
      lastSeen: otherUser?.lastSeen,
    };
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
      // Un-hide the conversation for the current user if they had deleted it.
      const state = await getConversationState(ctx, user._id, existing._id);
      if (state?.deletedAt !== undefined || state?.isArchived) {
        await upsertConversationState(ctx, user._id, existing._id, {
          deletedAt: undefined,
          isArchived: false,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("conversations", {
      memberOneId,
      memberTwoId,
      lastMessageAt: Date.now(),
    });
  },
});

export const setArchived = mutation({
  args: {
    conversationId: v.id("conversations"),
    archived: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    await upsertConversationState(ctx, user._id, args.conversationId, {
      isArchived: args.archived,
    });

    return null;
  },
});

export const setPinned = mutation({
  args: {
    conversationId: v.id("conversations"),
    pinned: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    await upsertConversationState(ctx, user._id, args.conversationId, {
      isPinned: args.pinned,
      pinnedAt: args.pinned ? Date.now() : undefined,
    });

    return null;
  },
});

export const setFavorite = mutation({
  args: {
    conversationId: v.id("conversations"),
    favorite: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    await upsertConversationState(ctx, user._id, args.conversationId, {
      isFavorite: args.favorite,
    });

    return null;
  },
});

export const markRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    await upsertConversationState(ctx, user._id, args.conversationId, {
      lastReadAt: Date.now(),
      manualUnread: false,
    });

    return null;
  },
});

export const markUnread = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    await upsertConversationState(ctx, user._id, args.conversationId, {
      manualUnread: true,
    });

    return null;
  },
});

export const remove = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    // Per-user delete: hide the conversation for the current user only.
    await upsertConversationState(ctx, user._id, args.conversationId, {
      deletedAt: Date.now(),
      isArchived: false,
      isPinned: false,
      pinnedAt: undefined,
    });

    return null;
  },
});

export const setBlocked = mutation({
  args: {
    otherUserId: v.id("users"),
    blocked: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (args.otherUserId === user._id) {
      throw new Error("Cannot block yourself");
    }

    const otherUser = await ctx.db.get("users", args.otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    const existing = await getBlockRecord(ctx, user._id, args.otherUserId);

    if (args.blocked) {
      if (!existing) {
        await ctx.db.insert("blocks", {
          blockerId: user._id,
          blockedId: args.otherUserId,
        });
      }
    } else if (existing) {
      await ctx.db.delete("blocks", existing._id);
    }

    return null;
  },
});
