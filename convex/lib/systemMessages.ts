import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { upsertConversationState } from "./conversationStates";

// Posts a WhatsApp-style "system" message into the conversation flow so every
// member sees a record of admin/membership actions. It bumps the conversation
// preview and marks the acting user's copy as read.
export async function postSystemMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  actorId: Id<"users">,
  text: string,
): Promise<void> {
  const createdAt = Date.now();

  await ctx.db.insert("messages", {
    conversationId,
    senderId: actorId,
    type: "system",
    text,
    createdAt,
  });

  await ctx.db.patch("conversations", conversationId, {
    lastMessageAt: createdAt,
    lastMessagePreview: text,
    lastMessageType: "text",
  });

  await upsertConversationState(ctx, actorId, conversationId, {
    lastReadAt: createdAt,
    manualUnread: false,
    deletedAt: undefined,
  });
}
