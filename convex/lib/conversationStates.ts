import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ConversationStatePatch = Partial<{
  isArchived: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  manualUnread: boolean;
  lastReadAt: number;
  pinnedAt: number | undefined;
  deletedAt: number | undefined;
}>;

export async function getConversationState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
): Promise<Doc<"conversationStates"> | null> {
  return await ctx.db
    .query("conversationStates")
    .withIndex("by_user_and_conversation", (q) =>
      q.eq("userId", userId).eq("conversationId", conversationId),
    )
    .unique();
}

export async function upsertConversationState(
  ctx: MutationCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
  patch: ConversationStatePatch,
): Promise<Id<"conversationStates">> {
  const existing = await getConversationState(ctx, userId, conversationId);

  if (existing) {
    await ctx.db.patch("conversationStates", existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("conversationStates", {
    userId,
    conversationId,
    isArchived: false,
    isPinned: false,
    isFavorite: false,
    manualUnread: false,
    lastReadAt: 0,
    ...patch,
  });
}
