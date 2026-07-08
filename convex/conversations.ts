import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getBlockRecord } from "./lib/blocks";
import { getCurrentUser } from "./lib/auth";
import {
  getConversationState,
  upsertConversationState,
} from "./lib/conversationStates";
import { sortMemberIds } from "./lib/conversations";
import {
  addMemberIfMissing,
  assertConversationMember,
  assertGroupAdmin,
  conversationKind,
  getMemberIds,
  getMembership,
} from "./lib/members";

const publicUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
  lastSeen: v.optional(v.number()),
});

const groupMemberValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
  lastSeen: v.optional(v.number()),
  role: v.union(v.literal("admin"), v.literal("member")),
});

const conversationPreviewValidator = v.object({
  _id: v.id("conversations"),
  kind: v.union(v.literal("direct"), v.literal("group")),
  title: v.string(),
  avatarUrl: v.optional(v.string()),
  memberCount: v.number(),
  lastMessageAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  lastMessageType: v.optional(v.union(v.literal("text"), v.literal("image"))),
  otherUser: v.optional(publicUserValidator),
  otherLastSeen: v.optional(v.number()),
  isArchived: v.boolean(),
  isPinned: v.boolean(),
  isFavorite: v.boolean(),
  unread: v.boolean(),
  isBlocked: v.boolean(),
});

export const list = query({
  args: {},
  returns: v.array(conversationPreviewValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const previews = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(
          "conversations",
          membership.conversationId,
        );
        if (!conversation) {
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

        const memberIds = await getMemberIds(ctx, conversation._id);
        const kind = conversationKind(conversation);

        let title: string;
        let avatarUrl: string | undefined;
        let otherUser:
          | {
              _id: (typeof memberIds)[number];
              name: string;
              email?: string;
              profileImage?: string;
              lastSeen?: number;
            }
          | undefined;
        let otherLastSeen: number | undefined;
        let isBlocked = false;

        if (kind === "group") {
          title = conversation.name ?? "Group";
          avatarUrl = conversation.imageUrl;
        } else {
          const otherUserId = memberIds.find((id) => id !== user._id);
          const otherUserDoc = otherUserId
            ? await ctx.db.get("users", otherUserId)
            : null;
          if (!otherUserDoc) {
            return null;
          }
          title = otherUserDoc.name;
          avatarUrl = otherUserDoc.profileImage;
          otherLastSeen = otherUserDoc.lastSeen;
          otherUser = {
            _id: otherUserDoc._id,
            name: otherUserDoc.name,
            email: otherUserDoc.email,
            profileImage: otherUserDoc.profileImage,
            lastSeen: otherUserDoc.lastSeen,
          };
          const iBlocked = await getBlockRecord(
            ctx,
            user._id,
            otherUserDoc._id,
          );
          isBlocked = iBlocked !== null;
        }

        const lastReadAt = state?.lastReadAt ?? 0;
        const hasMessage = conversation.lastMessagePreview !== undefined;
        const unread =
          state?.manualUnread === true ||
          (hasMessage && conversation.lastMessageAt > lastReadAt);

        return {
          pinnedAt: state?.pinnedAt ?? 0,
          preview: {
            _id: conversation._id,
            kind,
            title,
            avatarUrl,
            memberCount: memberIds.length,
            lastMessageAt: conversation.lastMessageAt,
            lastMessagePreview: conversation.lastMessagePreview,
            lastMessageType: conversation.lastMessageType,
            otherUser,
            otherLastSeen,
            isArchived: state?.isArchived ?? false,
            isPinned: state?.isPinned ?? false,
            isFavorite: state?.isFavorite ?? false,
            unread,
            isBlocked,
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

export const members = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(groupMemberValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const members = await Promise.all(
      rows.map(async (row) => {
        const u = await ctx.db.get("users", row.userId);
        if (!u) {
          return null;
        }
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          profileImage: u.profileImage,
          lastSeen: u.lastSeen,
          role: (row.role ?? "member") as "admin" | "member",
        };
      }),
    );

    return members
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === "admin" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  },
});

export const otherMemberStatus = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.object({
    otherUserId: v.union(v.id("users"), v.null()),
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

    if (conversationKind(conversation) === "group") {
      return { otherUserId: null, lastReadAt: 0, lastSeen: undefined };
    }

    const memberIds = await getMemberIds(ctx, args.conversationId);
    const otherUserId = memberIds.find((id) => id !== user._id) ?? null;
    if (otherUserId === null) {
      return { otherUserId: null, lastReadAt: 0, lastSeen: undefined };
    }

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
      await addMemberIfMissing(ctx, existing._id, memberOneId);
      await addMemberIfMissing(ctx, existing._id, memberTwoId);
      return existing._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      kind: "direct",
      memberOneId,
      memberTwoId,
      lastMessageAt: Date.now(),
    });
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: memberOneId,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: memberTwoId,
    });
    return conversationId;
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Group name is required");
    }

    // Deduplicate and exclude the creator (added below).
    const uniqueMemberIds = Array.from(new Set(args.memberIds)).filter(
      (id) => id !== user._id,
    );
    if (uniqueMemberIds.length === 0) {
      throw new Error("Add at least one other member");
    }

    for (const memberId of uniqueMemberIds) {
      const member = await ctx.db.get("users", memberId);
      if (!member) {
        throw new Error("One of the selected users no longer exists");
      }
    }

    let imageUrl: string | undefined;
    if (args.imageStorageId !== undefined) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (!url) {
        throw new Error("Uploaded image not found");
      }
      imageUrl = url;
    }

    const conversationId = await ctx.db.insert("conversations", {
      kind: "group",
      name,
      imageUrl,
      createdBy: user._id,
      lastMessageAt: Date.now(),
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: user._id,
      role: "admin",
    });
    for (const memberId of uniqueMemberIds) {
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: memberId,
        role: "member",
      });
    }

    return conversationId;
  },
});

export const leaveGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await assertConversationMember(
      ctx,
      args.conversationId,
      user._id,
    );

    if (conversationKind(conversation) !== "group") {
      throw new Error("Can only leave group conversations");
    }

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();
    if (membership) {
      await ctx.db.delete("conversationMembers", membership._id);
    }

    await ensureGroupHasAdmin(ctx, args.conversationId);

    return null;
  },
});

// If a group is left with no admins (e.g. the last admin leaves or is
// demoted), promote the longest-standing remaining member so the group is
// never leaderless.
async function ensureGroupHasAdmin(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
) {
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();

  if (rows.length === 0) {
    return;
  }
  if (rows.some((row) => row.role === "admin")) {
    return;
  }

  const oldest = rows.reduce((earliest, row) =>
    row._creationTime < earliest._creationTime ? row : earliest,
  );
  await ctx.db.patch("conversationMembers", oldest._id, { role: "admin" });
}

export const addGroupMembers = mutation({
  args: {
    conversationId: v.id("conversations"),
    memberIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupAdmin(ctx, args.conversationId, user._id);

    for (const memberId of args.memberIds) {
      const member = await ctx.db.get("users", memberId);
      if (!member) {
        throw new Error("One of the selected users no longer exists");
      }
      const existing = await getMembership(ctx, args.conversationId, memberId);
      if (!existing) {
        await ctx.db.insert("conversationMembers", {
          conversationId: args.conversationId,
          userId: memberId,
          role: "member",
        });
      }
    }

    return null;
  },
});

export const removeGroupMember = mutation({
  args: {
    conversationId: v.id("conversations"),
    memberId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupAdmin(ctx, args.conversationId, user._id);

    if (args.memberId === user._id) {
      throw new Error("Use leave group to remove yourself");
    }

    const membership = await getMembership(
      ctx,
      args.conversationId,
      args.memberId,
    );
    if (membership) {
      await ctx.db.delete("conversationMembers", membership._id);
    }

    await ensureGroupHasAdmin(ctx, args.conversationId);

    return null;
  },
});

export const setGroupAdmin = mutation({
  args: {
    conversationId: v.id("conversations"),
    memberId: v.id("users"),
    isAdmin: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupAdmin(ctx, args.conversationId, user._id);

    const membership = await getMembership(
      ctx,
      args.conversationId,
      args.memberId,
    );
    if (!membership) {
      throw new Error("That person is not a member of this group");
    }

    await ctx.db.patch("conversationMembers", membership._id, {
      role: args.isAdmin ? "admin" : "member",
    });

    await ensureGroupHasAdmin(ctx, args.conversationId);

    return null;
  },
});

export const updateGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupAdmin(ctx, args.conversationId, user._id);

    const patch: {
      name?: string;
      imageUrl?: string;
    } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) {
        throw new Error("Group name cannot be empty");
      }
      patch.name = name;
    }

    if (args.imageStorageId !== undefined) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (!url) {
        throw new Error("Uploaded image not found");
      }
      patch.imageUrl = url;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("conversations", args.conversationId, patch);
    }

    return null;
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
