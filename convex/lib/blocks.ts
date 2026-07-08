import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getBlockRecord(
  ctx: QueryCtx | MutationCtx,
  blockerId: Id<"users">,
  blockedId: Id<"users">,
): Promise<Doc<"blocks"> | null> {
  return await ctx.db
    .query("blocks")
    .withIndex("by_blocker_and_blocked", (q) =>
      q.eq("blockerId", blockerId).eq("blockedId", blockedId),
    )
    .unique();
}

export async function getBlockStatus(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  otherUserId: Id<"users">,
): Promise<{ iBlocked: boolean; blockedByThem: boolean }> {
  const [iBlocked, blockedByThem] = await Promise.all([
    getBlockRecord(ctx, userId, otherUserId),
    getBlockRecord(ctx, otherUserId, userId),
  ]);

  return { iBlocked: iBlocked !== null, blockedByThem: blockedByThem !== null };
}
