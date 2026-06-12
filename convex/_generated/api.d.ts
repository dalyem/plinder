/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_library from "../lib/library.js";
import type * as lib_plexApi from "../lib/plexApi.js";
import type * as lib_score from "../lib/score.js";
import type * as lib_tmdb from "../lib/tmdb.js";
import type * as media from "../media.js";
import type * as participants from "../participants.js";
import type * as plex from "../plex.js";
import type * as results from "../results.js";
import type * as sessions from "../sessions.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cleanup: typeof cleanup;
  crons: typeof crons;
  dev: typeof dev;
  "lib/guards": typeof lib_guards;
  "lib/ids": typeof lib_ids;
  "lib/library": typeof lib_library;
  "lib/plexApi": typeof lib_plexApi;
  "lib/score": typeof lib_score;
  "lib/tmdb": typeof lib_tmdb;
  media: typeof media;
  participants: typeof participants;
  plex: typeof plex;
  results: typeof results;
  sessions: typeof sessions;
  votes: typeof votes;
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
