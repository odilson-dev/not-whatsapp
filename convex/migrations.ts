import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { addMemberIfMissing } from "./lib/members";

// One-off migration: backfill `conversationMembers` rows and set `kind`
// for legacy direct conversations that predate the group feature.
// Run with: npx convex run migrations:backfillMembers
export const backfillMembers = internalMutation({
  args: {},
  returns: v.object({
    conversationsProcessed: v.number(),
    membersInserted: v.number(),
  }),
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();

    let membersInserted = 0;

    for (const conversation of conversations) {
      if (conversation.kind === undefined) {
        await ctx.db.patch("conversations", conversation._id, {
          kind: "direct",
        });
      }

      const memberIds = [
        conversation.memberOneId,
        conversation.memberTwoId,
      ].filter((id): id is NonNullable<typeof id> => id !== undefined);

      for (const userId of memberIds) {
        const existing = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation_and_user", (q) =>
            q.eq("conversationId", conversation._id).eq("userId", userId),
          )
          .unique();
        if (!existing) {
          await addMemberIfMissing(ctx, conversation._id, userId);
          membersInserted += 1;
        }
      }
    }

    return {
      conversationsProcessed: conversations.length,
      membersInserted,
    };
  },
});

// One-off migration: give every membership row an explicit role. Group
// creators become admins; everyone else becomes a member.
// Run with: npx convex run migrations:backfillRoles
export const backfillRoles = internalMutation({
  args: {},
  returns: v.object({
    membersUpdated: v.number(),
    adminsAssigned: v.number(),
  }),
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();

    let membersUpdated = 0;
    let adminsAssigned = 0;

    for (const conversation of conversations) {
      const rows = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .collect();

      const isGroup = (conversation.kind ?? "direct") === "group";

      for (const row of rows) {
        if (row.role !== undefined) {
          continue;
        }
        const shouldBeAdmin = isGroup && row.userId === conversation.createdBy;
        await ctx.db.patch("conversationMembers", row._id, {
          role: shouldBeAdmin ? "admin" : "member",
        });
        membersUpdated += 1;
        if (shouldBeAdmin) {
          adminsAssigned += 1;
        }
      }

      // Ensure any group without a resolved admin gets one.
      if (isGroup) {
        const refreshed = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .collect();
        if (refreshed.length > 0 && !refreshed.some((r) => r.role === "admin")) {
          const oldest = refreshed.reduce((earliest, r) =>
            r._creationTime < earliest._creationTime ? r : earliest,
          );
          await ctx.db.patch("conversationMembers", oldest._id, {
            role: "admin",
          });
          adminsAssigned += 1;
        }
      }
    }

    return { membersUpdated, adminsAssigned };
  },
});
