import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  senderId: v.id("users"),
  type: v.union(v.literal("text"), v.literal("image")),
  text: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
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
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(messageValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    let type: "text" | "image";
    let text: string | undefined;
    let imageUrl: string | undefined;

    if (args.imageStorageId !== undefined) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (!url) {
        throw new Error("Uploaded image not found");
      }
      type = "image";
      imageUrl = url;
    } else if (args.text !== undefined) {
      const trimmedText = args.text.trim();
      if (trimmedText.length === 0) {
        throw new Error("Message cannot be empty");
      }
      type = "text";
      text = trimmedText;
    } else {
      throw new Error("Message cannot be empty");
    }

    const createdAt = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      type,
      text,
      imageUrl,
      createdAt,
    });

    await ctx.db.patch("conversations", args.conversationId, {
      lastMessageAt: createdAt,
      lastMessagePreview: type === "text" ? text : "Photo",
      lastMessageType: type,
    });

    return messageId;
  },
});
