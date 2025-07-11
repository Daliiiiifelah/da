/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as chat from "../chat.js";
import type * as friends from "../friends.js";
import type * as http from "../http.js";
import type * as matches from "../matches.js";
import type * as notifications from "../notifications.js";
import type * as partyInvitations from "../partyInvitations.js";
import type * as ratings from "../ratings.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as userProfiles from "../userProfiles.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  blocks: typeof blocks;
  chat: typeof chat;
  friends: typeof friends;
  http: typeof http;
  matches: typeof matches;
  notifications: typeof notifications;
  partyInvitations: typeof partyInvitations;
  ratings: typeof ratings;
  reports: typeof reports;
  router: typeof router;
  userProfiles: typeof userProfiles;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
