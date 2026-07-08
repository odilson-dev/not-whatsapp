import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function isConversationMember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_and_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
  return row !== null;
}

export async function assertConversationMember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get("conversations", conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!(await isConversationMember(ctx, conversationId, userId))) {
    throw new Error("Unauthorized");
  }

  return conversation;
}

export async function getMemberIds(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
): Promise<Id<"users">[]> {
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  return rows.map((row) => row.userId);
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Doc<"conversationMembers"> | null> {
  return await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_and_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
}

export async function isGroupAdmin(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<boolean> {
  const membership = await getMembership(ctx, conversationId, userId);
  return membership?.role === "admin";
}

export async function assertGroupAdmin(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get("conversations", conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  if (conversationKind(conversation) !== "group") {
    throw new Error("Not a group conversation");
  }
  if (!(await isGroupAdmin(ctx, conversationId, userId))) {
    throw new Error("Only group admins can do this");
  }
  return conversation;
}

export async function addMemberIfMissing(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<void> {
  if (!(await isConversationMember(ctx, conversationId, userId))) {
    await ctx.db.insert("conversationMembers", { conversationId, userId });
  }
}

export function conversationKind(
  conversation: Doc<"conversations">,
): "direct" | "group" {
  return conversation.kind ?? "direct";
}
