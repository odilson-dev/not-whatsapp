import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { conversationKind } from "./lib/members";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const mediaItemValidator = v.object({
  _id: v.id("messages"),
  imageUrl: v.string(),
  createdAt: v.number(),
  conversationId: v.id("conversations"),
  conversationTitle: v.string(),
  senderName: v.optional(v.string()),
});

const linkItemValidator = v.object({
  _id: v.id("messages"),
  url: v.string(),
  text: v.optional(v.string()),
  createdAt: v.number(),
  conversationId: v.id("conversations"),
  conversationTitle: v.string(),
  senderName: v.optional(v.string()),
});

async function conversationTitleFor(
  ctx: QueryCtx,
  conversation: Doc<"conversations">,
  currentUserId: Id<"users">,
  userNameCache: Map<Id<"users">, string>,
): Promise<string> {
  if (conversationKind(conversation) === "group") {
    return conversation.name ?? "Group";
  }
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversation._id),
    )
    .collect();
  const otherId = members.map((m) => m.userId).find((id) => id !== currentUserId);
  if (!otherId) return "Chat";
  let name = userNameCache.get(otherId);
  if (name === undefined) {
    const other = await ctx.db.get("users", otherId);
    name = other?.name ?? "Chat";
    userNameCache.set(otherId, name);
  }
  return name;
}

export const listUserMedia = query({
  args: {},
  returns: v.object({
    media: v.array(mediaItemValidator),
    links: v.array(linkItemValidator),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const userNameCache = new Map<Id<"users">, string>();
    const senderNameCache = new Map<Id<"users">, string | undefined>();
    const getSenderName = async (id: Id<"users">) => {
      let name = senderNameCache.get(id);
      if (name === undefined && !senderNameCache.has(id)) {
        const sender = await ctx.db.get("users", id);
        name = sender?.name;
        senderNameCache.set(id, name);
      }
      return senderNameCache.get(id);
    };

    const media: (typeof mediaItemValidator.type)[] = [];
    const links: (typeof linkItemValidator.type)[] = [];

    for (const membership of memberships) {
      const conversation = await ctx.db.get(
        "conversations",
        membership.conversationId,
      );
      if (!conversation) continue;
      const title = await conversationTitleFor(
        ctx,
        conversation,
        user._id,
        userNameCache,
      );

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .collect();

      for (const message of messages) {
        if (message.type === "image" && message.imageUrl) {
          media.push({
            _id: message._id,
            imageUrl: message.imageUrl,
            createdAt: message.createdAt,
            conversationId: conversation._id,
            conversationTitle: title,
            senderName: await getSenderName(message.senderId),
          });
        } else if (message.type === "text" && message.text) {
          const matches = message.text.match(URL_REGEX);
          if (matches) {
            for (const url of matches) {
              links.push({
                _id: message._id,
                url,
                text: message.text,
                createdAt: message.createdAt,
                conversationId: conversation._id,
                conversationTitle: title,
                senderName: await getSenderName(message.senderId),
              });
            }
          }
        }
      }
    }

    media.sort((a, b) => b.createdAt - a.createdAt);
    links.sort((a, b) => b.createdAt - a.createdAt);

    return {
      media: media.slice(0, 500),
      links: links.slice(0, 200),
    };
  },
});
