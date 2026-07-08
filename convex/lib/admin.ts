import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUser } from "./auth";

export function isUserAdmin(user: Doc<"users">): boolean {
  return user.role === "admin";
}

// Returns the current user only if they are a platform admin. Throws otherwise.
export async function getCurrentAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!isUserAdmin(user)) {
    throw new Error("Unauthorized: admin access required");
  }
  return user;
}

// Throws if the given user is banned. Used to gate write actions (sending
// messages, creating conversations, etc.) for moderated accounts.
export function assertNotBanned(user: Doc<"users">): void {
  if (user.isBanned === true) {
    throw new Error(
      user.banReason && user.banReason.length > 0
        ? `Your account has been banned: ${user.banReason}`
        : "Your account has been banned.",
    );
  }
}
