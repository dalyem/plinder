import { v } from "convex/values";
import { query } from "./_generated/server";
import { getSessionByCode } from "./lib/guards";

/** Full deck snapshot — powers cards and detail sheets with zero Plex calls. */
export const deck = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    if (!session || session.status === "lobby") return null;
    const items = await ctx.db
      .query("mediaItems")
      .withIndex("by_session_order", (q) => q.eq("sessionId", session._id))
      .collect();
    return items.map((item) => ({
      mediaItemId: item._id,
      order: item.order,
      title: item.title,
      year: item.year,
      runtimeMin: item.runtimeMin,
      contentRating: item.contentRating,
      tmdbRating: item.tmdbRating,
      summary: item.summary,
      genres: item.genres,
      directors: item.directors,
      cast: item.cast,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      trailerKey: item.trailerKey,
    }));
  },
});
