import { v, Infer } from "convex/values";

// Filter shape shared by previewFilters and sessions.create (and the schema).
export const filtersValidator = v.object({
  genres: v.optional(v.array(v.string())), // Plex genre tag ids
  genreLabels: v.optional(v.array(v.string())), // display titles, same order
  unwatchedOnly: v.optional(v.boolean()),
  contentRatings: v.optional(v.array(v.string())),
  yearMin: v.optional(v.number()),
  yearMax: v.optional(v.number()),
  runtimeMinMin: v.optional(v.number()),
  runtimeMaxMin: v.optional(v.number()),
});

export type SessionFilters = Infer<typeof filtersValidator>;

export const plexTypeFor = (mediaType: "movie" | "show") =>
  mediaType === "movie" ? 1 : 2;

/**
 * Build the query string for /library/sections/{key}/all from session
 * filters. Runtime is intentionally NOT included — duration filtering is
 * unreliable across Plex versions, so it's applied in the action instead.
 * Plex numeric comparisons use `>>=` (gte) / `<<=` (lte) in the param key.
 */
export function buildFilterParams(
  mediaType: "movie" | "show",
  filters: SessionFilters
): string {
  const parts: string[] = [`type=${plexTypeFor(mediaType)}`];
  if (filters.genres && filters.genres.length > 0) {
    parts.push(`genre=${filters.genres.map(encodeURIComponent).join(",")}`);
  }
  if (filters.contentRatings && filters.contentRatings.length > 0) {
    parts.push(
      `contentRating=${filters.contentRatings.map(encodeURIComponent).join(",")}`
    );
  }
  if (filters.unwatchedOnly) parts.push("unwatched=1");
  if (filters.yearMin !== undefined)
    parts.push(`${encodeURIComponent("year>>")}=${filters.yearMin - 1}`);
  if (filters.yearMax !== undefined)
    parts.push(`${encodeURIComponent("year<<")}=${filters.yearMax + 1}`);
  return parts.join("&");
}

/** max(1, floor(sqrt(N)/2)) → 10–15:1, 20–30:2, 50:3, 100:5 */
export function superLikesFor(deckSize: number): number {
  return Math.max(1, Math.floor(Math.sqrt(deckSize) / 2));
}
