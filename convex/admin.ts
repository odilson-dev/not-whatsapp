import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCurrentAdmin } from "./lib/admin";
import { conversationKind } from "./lib/members";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Considered "online/active" if seen within this window.
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const roleValidator = v.union(v.literal("admin"), v.literal("user"));

// ---------------------------------------------------------------------------
// Access check for the client (does not throw so the UI can render a 403).
// ---------------------------------------------------------------------------
export const isCurrentUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user?.role === "admin";
  },
});

// ---------------------------------------------------------------------------
// Dashboard overview stats
// ---------------------------------------------------------------------------
const overviewValidator = v.object({
  users: v.object({
    total: v.number(),
    admins: v.number(),
    banned: v.number(),
    active: v.number(),
    newToday: v.number(),
    newThisWeek: v.number(),
  }),
  conversations: v.object({
    total: v.number(),
    groups: v.number(),
    direct: v.number(),
  }),
  messages: v.object({
    total: v.number(),
    today: v.number(),
    text: v.number(),
    image: v.number(),
    system: v.number(),
  }),
  blocks: v.number(),
  activity: v.array(v.object({ day: v.string(), count: v.number() })),
});

export const overview = query({
  args: { now: v.number() },
  returns: overviewValidator,
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);
    const now = args.now;

    const users = await ctx.db.query("users").collect();
    const conversations = await ctx.db.query("conversations").collect();
    const messages = await ctx.db.query("messages").collect();
    const blocks = await ctx.db.query("blocks").collect();

    const startOfWeek = now - WEEK_MS;
    const startOfDay = now - DAY_MS;

    let admins = 0;
    let banned = 0;
    let active = 0;
    let newToday = 0;
    let newThisWeek = 0;
    for (const user of users) {
      if (user.role === "admin") admins++;
      if (user.isBanned === true) banned++;
      if (user.lastSeen !== undefined && now - user.lastSeen <= ACTIVE_WINDOW_MS)
        active++;
      const createdMs = Date.parse(user.createdAt);
      if (!Number.isNaN(createdMs)) {
        if (createdMs >= startOfDay) newToday++;
        if (createdMs >= startOfWeek) newThisWeek++;
      }
    }

    let groups = 0;
    for (const conversation of conversations) {
      if (conversationKind(conversation) === "group") groups++;
    }

    let textCount = 0;
    let imageCount = 0;
    let systemCount = 0;
    let messagesToday = 0;
    // 7-day message activity buckets (oldest -> newest).
    const buckets: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      buckets.push({
        day: d.toLocaleDateString(undefined, {
          weekday: "short",
        }),
        count: 0,
      });
    }
    for (const message of messages) {
      if (message.type === "text") textCount++;
      else if (message.type === "image") imageCount++;
      else if (message.type === "system") systemCount++;
      if (message.createdAt >= startOfDay) messagesToday++;
      const bucketIndex = 6 - Math.floor((now - message.createdAt) / DAY_MS);
      if (bucketIndex >= 0 && bucketIndex <= 6) {
        buckets[bucketIndex].count++;
      }
    }

    return {
      users: {
        total: users.length,
        admins,
        banned,
        active,
        newToday,
        newThisWeek,
      },
      conversations: {
        total: conversations.length,
        groups,
        direct: conversations.length - groups,
      },
      messages: {
        total: messages.length,
        today: messagesToday,
        text: textCount,
        image: imageCount,
        system: systemCount,
      },
      blocks: blocks.length,
      activity: buckets,
    };
  },
});

// ---------------------------------------------------------------------------
// Users management
// ---------------------------------------------------------------------------
const adminUserValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
  createdAt: v.string(),
  lastSeen: v.optional(v.number()),
  role: v.optional(roleValidator),
  isBanned: v.optional(v.boolean()),
  bannedAt: v.optional(v.number()),
  banReason: v.optional(v.string()),
});

function toAdminUser(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
    lastSeen: user.lastSeen,
    role: user.role,
    isBanned: user.isBanned,
    bannedAt: user.bannedAt,
    banReason: user.banReason,
  };
}

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("admins"),
        v.literal("banned"),
        v.literal("active"),
      ),
    ),
    now: v.optional(v.number()),
  },
  returns: v.object({
    users: v.array(adminUserValidator),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);

    const all = await ctx.db.query("users").collect();
    const search = args.search?.trim().toLowerCase() ?? "";
    const filter = args.filter ?? "all";
    const now = args.now ?? 0;

    const filtered = all.filter((user) => {
      if (search.length > 0) {
        const matches =
          user.name.toLowerCase().includes(search) ||
          user.email?.toLowerCase().includes(search) === true;
        if (!matches) return false;
      }
      if (filter === "admins") return user.role === "admin";
      if (filter === "banned") return user.isBanned === true;
      if (filter === "active")
        return (
          user.lastSeen !== undefined && now - user.lastSeen <= ACTIVE_WINDOW_MS
        );
      return true;
    });

    filtered.sort((a, b) => b._creationTime - a._creationTime);

    return {
      users: filtered.slice(0, 500).map(toAdminUser),
      total: filtered.length,
    };
  },
});

const userDetailValidator = v.object({
  user: adminUserValidator,
  stats: v.object({
    messages: v.number(),
    conversations: v.number(),
    groupsCreated: v.number(),
    blocksMade: v.number(),
    blockedBy: v.number(),
  }),
});

export const getUserDetail = query({
  args: { userId: v.id("users") },
  returns: v.union(userDetailValidator, v.null()),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);

    const user = await ctx.db.get("users", args.userId);
    if (!user) return null;

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const blocksMade = await ctx.db
      .query("blocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", args.userId))
      .collect();
    const blockedBy = await ctx.db
      .query("blocks")
      .withIndex("by_blocked", (q) => q.eq("blockedId", args.userId))
      .collect();

    // Message count requires scanning conversations the user belongs to.
    let messageCount = 0;
    for (const membership of memberships) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", membership.conversationId),
        )
        .collect();
      messageCount += messages.filter(
        (m) => m.senderId === args.userId,
      ).length;
    }

    const conversations = await ctx.db.query("conversations").collect();
    const groupsCreated = conversations.filter(
      (c) => c.createdBy === args.userId && conversationKind(c) === "group",
    ).length;

    return {
      user: toAdminUser(user),
      stats: {
        messages: messageCount,
        conversations: memberships.length,
        groupsCreated,
        blocksMade: blocksMade.length,
        blockedBy: blockedBy.length,
      },
    };
  },
});

export const setUserBanned = mutation({
  args: {
    userId: v.id("users"),
    banned: v.boolean(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await getCurrentAdmin(ctx);
    if (admin._id === args.userId) {
      throw new Error("You can't ban yourself");
    }
    const target = await ctx.db.get("users", args.userId);
    if (!target) throw new Error("User not found");

    if (args.banned) {
      await ctx.db.patch("users", args.userId, {
        isBanned: true,
        bannedAt: Date.now(),
        banReason: args.reason?.trim() || undefined,
      });
    } else {
      await ctx.db.patch("users", args.userId, {
        isBanned: false,
        bannedAt: undefined,
        banReason: undefined,
      });
    }
    return null;
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await getCurrentAdmin(ctx);
    if (admin._id === args.userId && args.role !== "admin") {
      throw new Error("You can't remove your own admin access");
    }
    const target = await ctx.db.get("users", args.userId);
    if (!target) throw new Error("User not found");

    await ctx.db.patch("users", args.userId, { role: args.role });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Cascade helpers
// ---------------------------------------------------------------------------
async function deleteConversationCascade(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
): Promise<void> {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  for (const message of messages) {
    await ctx.db.delete("messages", message._id);
  }

  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  for (const member of members) {
    await ctx.db.delete("conversationMembers", member._id);
    const state = await ctx.db
      .query("conversationStates")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", member.userId).eq("conversationId", conversationId),
      )
      .unique();
    if (state) {
      await ctx.db.delete("conversationStates", state._id);
    }
  }

  await ctx.db.delete("conversations", conversationId);
}

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await getCurrentAdmin(ctx);
    if (admin._id === args.userId) {
      throw new Error("You can't delete your own account here");
    }
    const target = await ctx.db.get("users", args.userId);
    if (!target) throw new Error("User not found");

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of memberships) {
      const conversation = await ctx.db.get(
        "conversations",
        membership.conversationId,
      );
      if (!conversation) {
        await ctx.db.delete("conversationMembers", membership._id);
        continue;
      }
      if (conversationKind(conversation) === "direct") {
        // A 1:1 chat makes no sense without both parties -> remove it entirely.
        await deleteConversationCascade(ctx, membership.conversationId);
      } else {
        // Group: remove just this member and their authored messages.
        await ctx.db.delete("conversationMembers", membership._id);
        const groupMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", membership.conversationId),
          )
          .collect();
        for (const message of groupMessages) {
          if (message.senderId === args.userId) {
            await ctx.db.delete("messages", message._id);
          }
        }
        const state = await ctx.db
          .query("conversationStates")
          .withIndex("by_user_and_conversation", (q) =>
            q
              .eq("userId", args.userId)
              .eq("conversationId", membership.conversationId),
          )
          .unique();
        if (state) {
          await ctx.db.delete("conversationStates", state._id);
        }
      }
    }

    // Remaining per-user states (e.g. for chats already cleaned up).
    const remainingStates = await ctx.db
      .query("conversationStates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const state of remainingStates) {
      await ctx.db.delete("conversationStates", state._id);
    }

    // Block relationships in both directions.
    const blocksMade = await ctx.db
      .query("blocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", args.userId))
      .collect();
    for (const block of blocksMade) {
      await ctx.db.delete("blocks", block._id);
    }
    const blockedBy = await ctx.db
      .query("blocks")
      .withIndex("by_blocked", (q) => q.eq("blockedId", args.userId))
      .collect();
    for (const block of blockedBy) {
      await ctx.db.delete("blocks", block._id);
    }

    await ctx.db.delete("users", args.userId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Conversations / groups management
// ---------------------------------------------------------------------------
const adminConversationValidator = v.object({
  _id: v.id("conversations"),
  _creationTime: v.number(),
  kind: v.union(v.literal("direct"), v.literal("group")),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  memberCount: v.number(),
  messageCount: v.number(),
  lastMessageAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  createdByName: v.optional(v.string()),
  memberNames: v.array(v.string()),
});

export const listConversations = query({
  args: {
    search: v.optional(v.string()),
    filter: v.optional(
      v.union(v.literal("all"), v.literal("group"), v.literal("direct")),
    ),
  },
  returns: v.object({
    conversations: v.array(adminConversationValidator),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);

    const all = await ctx.db.query("conversations").collect();
    const filter = args.filter ?? "all";
    const search = args.search?.trim().toLowerCase() ?? "";

    const nameCache = new Map<Id<"users">, string>();
    const getName = async (userId: Id<"users">): Promise<string> => {
      const cached = nameCache.get(userId);
      if (cached !== undefined) return cached;
      const user = await ctx.db.get("users", userId);
      const name = user?.name ?? "Unknown";
      nameCache.set(userId, name);
      return name;
    };

    const enriched = [];
    for (const conversation of all) {
      const kind = conversationKind(conversation);
      if (filter !== "all" && filter !== kind) continue;

      const members = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .collect();
      const memberNames = await Promise.all(
        members.map((m) => getName(m.userId)),
      );

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .collect();

      const title =
        kind === "group"
          ? conversation.name ?? "Unnamed group"
          : memberNames.join(", ");
      if (search.length > 0 && !title.toLowerCase().includes(search)) {
        continue;
      }

      enriched.push({
        _id: conversation._id,
        _creationTime: conversation._creationTime,
        kind,
        name: conversation.name,
        imageUrl: conversation.imageUrl,
        memberCount: members.length,
        messageCount: messages.length,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        createdByName: conversation.createdBy
          ? await getName(conversation.createdBy)
          : undefined,
        memberNames,
      });
    }

    enriched.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return {
      conversations: enriched.slice(0, 500),
      total: enriched.length,
    };
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);
    const conversation = await ctx.db.get("conversations", args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    await deleteConversationCascade(ctx, args.conversationId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Messages management
// ---------------------------------------------------------------------------
const adminMessageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  type: v.union(v.literal("text"), v.literal("image"), v.literal("system")),
  text: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  senderName: v.optional(v.string()),
  senderImage: v.optional(v.string()),
  conversationTitle: v.string(),
});

async function enrichMessage(
  ctx: QueryCtx,
  message: Doc<"messages">,
  nameCache: Map<Id<"users">, Doc<"users"> | null>,
) {
  let sender = nameCache.get(message.senderId);
  if (sender === undefined) {
    sender = await ctx.db.get("users", message.senderId);
    nameCache.set(message.senderId, sender);
  }
  const conversation = await ctx.db.get(
    "conversations",
    message.conversationId,
  );
  let conversationTitle = "Direct chat";
  if (conversation && conversationKind(conversation) === "group") {
    conversationTitle = conversation.name ?? "Unnamed group";
  }
  return {
    _id: message._id,
    _creationTime: message._creationTime,
    conversationId: message.conversationId,
    type: message.type,
    text: message.text,
    imageUrl: message.imageUrl,
    createdAt: message.createdAt,
    senderName: sender?.name,
    senderImage: sender?.profileImage,
    conversationTitle,
  };
}

export const listMessages = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(adminMessageValidator),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);

    const nameCache = new Map<Id<"users">, Doc<"users"> | null>();

    if (args.conversationId !== undefined) {
      const convId = args.conversationId;
      const page = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", convId),
        )
        .order("desc")
        .paginate(args.paginationOpts);
      const enriched = await Promise.all(
        page.page.map((m) => enrichMessage(ctx, m, nameCache)),
      );
      return { ...page, page: enriched };
    }

    const page = await ctx.db
      .query("messages")
      .order("desc")
      .paginate(args.paginationOpts);
    const enriched = await Promise.all(
      page.page.map((m) => enrichMessage(ctx, m, nameCache)),
    );
    return { ...page, page: enriched };
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getCurrentAdmin(ctx);
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) return null;

    await ctx.db.delete("messages", args.messageId);

    const conversation = await ctx.db.get(
      "conversations",
      message.conversationId,
    );
    if (conversation && message.createdAt >= conversation.lastMessageAt) {
      const latest = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", message.conversationId),
        )
        .order("desc")
        .first();
      if (latest) {
        await ctx.db.patch("conversations", message.conversationId, {
          lastMessageAt: latest.createdAt,
          lastMessagePreview:
            latest.type === "image" ? "Photo" : latest.text,
          lastMessageType: latest.type === "image" ? "image" : "text",
        });
      } else {
        await ctx.db.patch("conversations", message.conversationId, {
          lastMessagePreview: undefined,
          lastMessageType: undefined,
        });
      }
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Bootstrap: promote a user to admin by email. Run from the CLI, e.g.
//   npx convex run admin:makeAdminByEmail '{"email":"you@example.com"}'
// ---------------------------------------------------------------------------
export const makeAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const target = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.trim()))
      .unique();

    // Fall back to a scan for case-insensitive matching.
    const resolved =
      user ??
      (await ctx.db.query("users").collect()).find(
        (u) => u.email?.toLowerCase() === target,
      );

    if (!resolved) {
      throw new Error(`No user found with email ${args.email}`);
    }

    await ctx.db.patch("users", resolved._id, { role: "admin" });
    return `Promoted ${resolved.name} (${resolved.email ?? "no email"}) to admin`;
  },
});
