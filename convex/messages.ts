import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { getBlockStatus } from "./lib/blocks";
import { upsertConversationState } from "./lib/conversationStates";
import {
  assertConversationMember,
  conversationKind,
  getMemberIds,
  isGroupAdmin,
} from "./lib/members";

const messageTypeValidator = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("system"),
);

const replyToValidator = v.object({
  messageId: v.id("messages"),
  senderId: v.id("users"),
  type: messageTypeValidator,
  text: v.optional(v.string()),
});

const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  senderId: v.id("users"),
  type: messageTypeValidator,
  text: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  forwarded: v.optional(v.boolean()),
  mentions: v.optional(v.array(v.id("users"))),
  replyTo: v.optional(replyToValidator),
  senderName: v.optional(v.string()),
  senderImage: v.optional(v.string()),
});

async function otherDirectMemberId(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Id<"users"> | undefined> {
  const memberIds = await getMemberIds(ctx, conversationId);
  return memberIds.find((id) => id !== userId);
}

export const list = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(messageValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    const page = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const senderCache = new Map<Id<"users">, Doc<"users"> | null>();
    const enriched = await Promise.all(
      page.page.map(async (message) => {
        let sender = senderCache.get(message.senderId);
        if (sender === undefined) {
          sender = await ctx.db.get("users", message.senderId);
          senderCache.set(message.senderId, sender);
        }
        return {
          ...message,
          senderName: sender?.name,
          senderImage: sender?.profileImage,
        };
      }),
    );

    return { ...page, page: enriched };
  },
});

const sharedImageValidator = v.object({
  _id: v.id("messages"),
  imageUrl: v.string(),
  createdAt: v.number(),
});

export const listSharedImages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(sharedImageValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertConversationMember(ctx, args.conversationId, user._id);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .collect();

    return messages
      .filter(
        (message): message is typeof message & { imageUrl: string } =>
          message.type === "image" && message.imageUrl !== undefined,
      )
      .map((message) => ({
        _id: message._id,
        imageUrl: message.imageUrl,
        createdAt: message.createdAt,
      }));
  },
});

async function assertNotBlocked(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  otherUserId: Id<"users">,
) {
  const { iBlocked, blockedByThem } = await getBlockStatus(
    ctx,
    userId,
    otherUserId,
  );
  if (iBlocked) {
    throw new Error("You blocked this contact. Unblock them to send messages.");
  }
  if (blockedByThem) {
    throw new Error("You can't send messages to this contact.");
  }
}

async function afterMessageSent(
  ctx: MutationCtx,
  senderId: Id<"users">,
  conversationId: Id<"conversations">,
  type: "text" | "image",
  text: string | undefined,
  createdAt: number,
) {
  await ctx.db.patch("conversations", conversationId, {
    lastMessageAt: createdAt,
    lastMessagePreview: type === "text" ? text : "Photo",
    lastMessageType: type,
  });

  // Keep the sender's own conversation marked as read and un-hide it if the
  // sender had previously deleted the chat.
  await upsertConversationState(ctx, senderId, conversationId, {
    lastReadAt: createdAt,
    manualUnread: false,
    deletedAt: undefined,
  });
}

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    replyToId: v.optional(v.id("messages")),
    mentions: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await assertConversationMember(
      ctx,
      args.conversationId,
      user._id,
    );

    if (conversationKind(conversation) === "direct") {
      const otherUserId = await otherDirectMemberId(
        ctx,
        args.conversationId,
        user._id,
      );
      if (otherUserId) {
        await assertNotBlocked(ctx, user._id, otherUserId);
      }
    }

    // Only keep mentions that are actual members of this conversation.
    let mentions: Id<"users">[] | undefined;
    if (args.mentions && args.mentions.length > 0) {
      const memberIds = new Set(await getMemberIds(ctx, args.conversationId));
      const valid = Array.from(new Set(args.mentions)).filter((id) =>
        memberIds.has(id),
      );
      mentions = valid.length > 0 ? valid : undefined;
    }

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

    let replyTo: typeof replyToValidator.type | undefined;
    if (args.replyToId !== undefined) {
      const original = await ctx.db.get("messages", args.replyToId);
      if (original && original.conversationId === args.conversationId) {
        replyTo = {
          messageId: original._id,
          senderId: original.senderId,
          type: original.type,
          text: original.type === "text" ? original.text : "Photo",
        };
      }
    }

    const createdAt = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      type,
      text,
      imageUrl,
      createdAt,
      replyTo,
      mentions,
    });

    await afterMessageSent(ctx, user._id, args.conversationId, type, text, createdAt);

    return messageId;
  },
});

export const forward = mutation({
  args: {
    messageId: v.id("messages"),
    targetConversationId: v.id("conversations"),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const original = await ctx.db.get("messages", args.messageId);
    if (!original) {
      throw new Error("Message not found");
    }
    if (original.type === "system") {
      throw new Error("System messages cannot be forwarded");
    }
    // Caller must be a member of both the source and the target conversation.
    await assertConversationMember(ctx, original.conversationId, user._id);
    const targetConversation = await assertConversationMember(
      ctx,
      args.targetConversationId,
      user._id,
    );

    if (conversationKind(targetConversation) === "direct") {
      const otherUserId = await otherDirectMemberId(
        ctx,
        args.targetConversationId,
        user._id,
      );
      if (otherUserId) {
        await assertNotBlocked(ctx, user._id, otherUserId);
      }
    }

    const createdAt = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.targetConversationId,
      senderId: user._id,
      type: original.type,
      text: original.text,
      imageUrl: original.imageUrl,
      createdAt,
      forwarded: true,
    });

    await afterMessageSent(
      ctx,
      user._id,
      args.targetConversationId,
      original.type,
      original.text,
      createdAt,
    );

    return messageId;
  },
});

export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      return null;
    }

    const conversation = await assertConversationMember(
      ctx,
      message.conversationId,
      user._id,
    );

    // A message can be deleted by its author, or by a group admin.
    const isOwn = message.senderId === user._id;
    const canModerate =
      conversationKind(conversation) === "group" &&
      (await isGroupAdmin(ctx, message.conversationId, user._id));
    if (!isOwn && !canModerate) {
      throw new Error("You can only delete your own messages");
    }

    await ctx.db.delete("messages", args.messageId);

    // If we removed the most recent message, refresh the conversation preview.
    if (message.createdAt >= conversation.lastMessageAt) {
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
