import type { Id } from "../_generated/dataModel";

export function sortMemberIds(
  userIdA: Id<"users">,
  userIdB: Id<"users">,
): [Id<"users">, Id<"users">] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

export function getOtherMemberId(
  conversation: {
    memberOneId: Id<"users">;
    memberTwoId: Id<"users">;
  },
  currentUserId: Id<"users">,
): Id<"users"> {
  return conversation.memberOneId === currentUserId
    ? conversation.memberTwoId
    : conversation.memberOneId;
}
