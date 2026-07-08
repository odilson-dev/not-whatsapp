import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertNotBanned } from "./lib/admin";
import { getCurrentUser } from "./lib/auth";

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

const publicUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  profileImage: v.optional(v.string()),
});

const statusItemValidator = v.object({
  _id: v.id("statuses"),
  type: v.union(v.literal("text"), v.literal("image")),
  text: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  createdAt: v.number(),
  viewed: v.boolean(),
});

const bucketValidator = v.object({
  user: publicUserValidator,
  statuses: v.array(statusItemValidator),
  hasUnviewed: v.boolean(),
  latestAt: v.number(),
});

export const post = mutation({
  args: {
    text: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    backgroundColor: v.optional(v.string()),
  },
  returns: v.id("statuses"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    assertNotBanned(user);

    const createdAt = Date.now();
    const expiresAt = createdAt + STATUS_TTL_MS;

    if (args.imageStorageId !== undefined) {
      const imageUrl = await ctx.storage.getUrl(args.imageStorageId);
      if (!imageUrl) {
        throw new Error("Uploaded image not found");
      }
      return await ctx.db.insert("statuses", {
        userId: user._id,
        type: "image",
        imageUrl,
        text: args.text?.trim() || undefined,
        createdAt,
        expiresAt,
      });
    }

    const text = args.text?.trim();
    if (!text) {
      throw new Error("Status cannot be empty");
    }
    return await ctx.db.insert("statuses", {
      userId: user._id,
      type: "text",
      text,
      backgroundColor: args.backgroundColor,
      createdAt,
      expiresAt,
    });
  },
});

export const listActive = query({
  args: { now: v.number() },
  returns: v.object({
    me: v.union(bucketValidator, v.null()),
    others: v.array(bucketValidator),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const active = await ctx.db
      .query("statuses")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", args.now))
      .collect();

    // Which statuses has the current user already seen?
    const myViews = await ctx.db
      .query("statusViews")
      .withIndex("by_viewer", (q) => q.eq("viewerId", user._id))
      .collect();
    const viewedIds = new Set(myViews.map((v) => v.statusId));

    // Group by author.
    const byUser = new Map<Id<"users">, Doc<"statuses">[]>();
    for (const status of active) {
      const list = byUser.get(status.userId) ?? [];
      list.push(status);
      byUser.set(status.userId, list);
    }

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      let cached = userCache.get(id);
      if (cached === undefined) {
        cached = await ctx.db.get("users", id);
        userCache.set(id, cached);
      }
      return cached;
    };

    let me: typeof bucketValidator.type | null = null;
    const others: (typeof bucketValidator.type)[] = [];

    for (const [userId, statuses] of byUser) {
      const author = await getUser(userId);
      if (!author) continue;
      statuses.sort((a, b) => a.createdAt - b.createdAt);
      const items = statuses.map((s) => ({
        _id: s._id,
        type: s.type,
        text: s.text,
        imageUrl: s.imageUrl,
        backgroundColor: s.backgroundColor,
        createdAt: s.createdAt,
        viewed: viewedIds.has(s._id),
      }));
      const bucket = {
        user: {
          _id: author._id,
          name: author.name,
          profileImage: author.profileImage,
        },
        statuses: items,
        hasUnviewed: items.some((i) => !i.viewed),
        latestAt: statuses[statuses.length - 1].createdAt,
      };
      if (userId === user._id) {
        me = bucket;
      } else {
        others.push(bucket);
      }
    }

    others.sort((a, b) => b.latestAt - a.latestAt);
    return { me, others };
  },
});

export const markViewed = mutation({
  args: { statusId: v.id("statuses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const status = await ctx.db.get("statuses", args.statusId);
    if (!status) return null;
    if (status.userId === user._id) return null;

    const existing = await ctx.db
      .query("statusViews")
      .withIndex("by_status_and_viewer", (q) =>
        q.eq("statusId", args.statusId).eq("viewerId", user._id),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("statusViews", {
        statusId: args.statusId,
        viewerId: user._id,
        viewedAt: Date.now(),
      });
    }
    return null;
  },
});

export const remove = mutation({
  args: { statusId: v.id("statuses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const status = await ctx.db.get("statuses", args.statusId);
    if (!status) return null;
    if (status.userId !== user._id) {
      throw new Error("You can only delete your own status");
    }
    // Clean up view records for this status.
    const views = await ctx.db
      .query("statusViews")
      .withIndex("by_status_and_viewer", (q) => q.eq("statusId", args.statusId))
      .collect();
    for (const view of views) {
      await ctx.db.delete("statusViews", view._id);
    }
    await ctx.db.delete("statuses", args.statusId);
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    assertNotBanned(user);
    return await ctx.storage.generateUploadUrl();
  },
});
