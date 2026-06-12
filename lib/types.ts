import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type SessionView = NonNullable<
  FunctionReturnType<typeof api.sessions.get>
>;
export type RosterEntry = FunctionReturnType<
  typeof api.sessions.roster
>[number];
export type DeckItem = NonNullable<
  FunctionReturnType<typeof api.media.deck>
>[number];
export type ResultsView = NonNullable<FunctionReturnType<typeof api.results.get>>;
export type ResultItem = ResultsView["items"][number];
export type VoteValue = 0 | 1 | 2;
