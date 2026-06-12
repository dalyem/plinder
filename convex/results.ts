import { v } from "convex/values";
import { query } from "./_generated/server";
import { getSessionByCode } from "./lib/guards";
import { computeScores } from "./lib/score";

const itemView = (item: {
  _id: unknown;
  title: string;
  year?: number;
  runtimeMin?: number;
  posterPath?: string;
  backdropPath?: string;
  genres: string[];
}) => ({
  mediaItemId: item._id,
  title: item.title,
  year: item.year,
  runtimeMin: item.runtimeMin,
  posterPath: item.posterPath,
  backdropPath: item.backdropPath,
  genres: item.genres,
});

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    if (!session || session.status !== "results") return null;
    const { scores, topPicks, unanimousYes, unanimousNo } = await computeScores(
      ctx,
      session
    );
    return {
      items: scores.map((s) => ({
        ...itemView(s.item),
        score: s.score,
        yesNames: s.yesNames,
        superNames: s.superNames,
        noCount: s.noCount,
      })),
      topPickIds: topPicks,
      unanimousYesIds: unanimousYes,
      unanimousNoIds: unanimousNo,
      tieWinnerItemId: session.tieWinnerItemId,
      expiresAt: session.expiresAt,
    };
  },
});
