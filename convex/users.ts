import type { UserIdentity } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  userId: v.string(),
  createdAt: v.string(),
  tokenIdentifier: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
});

function profileFromIdentity(
  identity: UserIdentity,
  args: { name?: string; email?: string; imageUrl?: string },
) {
  const nameFromIdentity =
    identity.name ??
    (identity.givenName && identity.familyName
      ? `${identity.givenName} ${identity.familyName}`
      : identity.givenName) ??
    identity.nickname ??
    identity.preferredUsername;

  return {
    name: nameFromIdentity ?? args.name ?? "Anonymous",
    email: identity.email ?? args.email,
    profileImage: identity.pictureUrl ?? args.imageUrl,
  };
}

export const store = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = profileFromIdentity(identity, args);

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      const updates: {
        email?: string;
      } = {};

      if (profile.email && user.email !== profile.email) {
        updates.email = profile.email;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch("users", user._id, updates);
      }

      return user._id;
    }

    return await ctx.db.insert("users", {
      userId: identity.subject,
      createdAt: new Date().toISOString(),
      tokenIdentifier: identity.tokenIdentifier,
      ...profile,
    });
  },
});

export const viewer = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

export const me = query({
  args: {},
  returns: userValidator,
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

const publicUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.optional(v.string()),
  profileImage: v.optional(v.string()),
});

export const search = query({
  args: {
    query: v.string(),
  },
  returns: v.array(publicUserValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const searchTerm = args.query.trim().toLowerCase();

    if (searchTerm.length === 0) {
      return [];
    }

    const users = await ctx.db.query("users").collect();

    return users
      .filter((candidate) => {
        if (candidate._id === user._id) {
          return false;
        }

        return (
          candidate.name.toLowerCase().includes(searchTerm) ||
          candidate.email?.toLowerCase().includes(searchTerm) === true
        );
      })
      .slice(0, 20)
      .map((candidate) => ({
        _id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        profileImage: candidate.profileImage,
      }));
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    profileImageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const updates: {
      name?: string;
      profileImage?: string;
    } = {};

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new Error("Name cannot be empty");
      }
      updates.name = trimmedName;
    }

    if (args.profileImageStorageId !== undefined) {
      const profileImage = await ctx.storage.getUrl(args.profileImageStorageId);
      if (!profileImage) {
        throw new Error("Uploaded image not found");
      }
      updates.profileImage = profileImage;
    }

    if (Object.keys(updates).length === 0) {
      return null;
    }

    await ctx.db.patch("users", user._id, updates);
    return null;
  },
});
