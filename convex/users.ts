import type { UserIdentity } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
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
      if (
        user.name !== profile.name ||
        user.email !== profile.email ||
        user.profileImage !== profile.profileImage
      ) {
        await ctx.db.patch("users", user._id, profile);
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
