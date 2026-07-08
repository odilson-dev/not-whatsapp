/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as conversations from "../conversations.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_blocks from "../lib/blocks.js";
import type * as lib_conversationStates from "../lib/conversationStates.js";
import type * as lib_conversations from "../lib/conversations.js";
import type * as lib_members from "../lib/members.js";
import type * as lib_systemMessages from "../lib/systemMessages.js";
import type * as media from "../media.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as status from "../status.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  conversations: typeof conversations;
  "lib/admin": typeof lib_admin;
  "lib/auth": typeof lib_auth;
  "lib/blocks": typeof lib_blocks;
  "lib/conversationStates": typeof lib_conversationStates;
  "lib/conversations": typeof lib_conversations;
  "lib/members": typeof lib_members;
  "lib/systemMessages": typeof lib_systemMessages;
  media: typeof media;
  messages: typeof messages;
  migrations: typeof migrations;
  status: typeof status;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
