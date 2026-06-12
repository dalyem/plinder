import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type ItemScore = {
  item: Doc<"mediaItems">;
  score: number;
  yesNames: string[]; // value >= 1 (includes super likers)
  superNames: string[]; // value == 2
  noCount: number;
};

export type SessionScores = {
  scores: ItemScore[]; // sorted by score desc, then deck order
  topPicks: Id<"mediaItems">[]; // all items tied at the max score
  unanimousYes: Id<"mediaItems">[];
  unanimousNo: Id<"mediaItems">[];
};

/**
 * Aggregate every vote in the session. Participants who never cast a vote
 * are excluded from the unanimity math (joined-then-bailed guests shouldn't
 * block "everyone said yes").
 */
export async function computeScores(
  ctx: QueryCtx,
  session: Doc<"sessions">
): Promise<SessionScores> {
  const [items, participants, votes] = await Promise.all([
    ctx.db
      .query("mediaItems")
      .withIndex("by_session_order", (q) => q.eq("sessionId", session._id))
      .collect(),
    ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect(),
    ctx.db
      .query("votes")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect(),
  ]);

  const participantNames = new Map(participants.map((p) => [p._id, p.name]));
  const voters = new Set(votes.map((v) => v.participantId));

  const byItem = new Map<
    Id<"mediaItems">,
    { score: number; yesNames: string[]; superNames: string[]; noCount: number; votedBy: Map<Id<"participants">, number> }
  >();
  for (const item of items) {
    byItem.set(item._id, {
      score: 0,
      yesNames: [],
      superNames: [],
      noCount: 0,
      votedBy: new Map(),
    });
  }
  for (const vote of votes) {
    const agg = byItem.get(vote.mediaItemId);
    if (!agg) continue;
    agg.score += vote.value;
    agg.votedBy.set(vote.participantId, vote.value);
    const name = participantNames.get(vote.participantId) ?? "?";
    if (vote.value >= 1) agg.yesNames.push(name);
    if (vote.value === 2) agg.superNames.push(name);
    if (vote.value === 0) agg.noCount += 1;
  }

  const scores: ItemScore[] = items
    .map((item) => {
      const agg = byItem.get(item._id)!;
      return {
        item,
        score: agg.score,
        yesNames: agg.yesNames,
        superNames: agg.superNames,
        noCount: agg.noCount,
      };
    })
    .sort((a, b) => b.score - a.score || a.item.order - b.item.order);

  const maxScore = scores.length > 0 ? scores[0].score : 0;
  const topPicks = scores
    .filter((s) => s.score === maxScore && maxScore > 0)
    .map((s) => s.item._id);

  const activeVoters = [...voters];
  const unanimousYes: Id<"mediaItems">[] = [];
  const unanimousNo: Id<"mediaItems">[] = [];
  if (activeVoters.length > 0) {
    for (const item of items) {
      const agg = byItem.get(item._id)!;
      const allVoted = activeVoters.every((p) => agg.votedBy.has(p));
      if (!allVoted) continue;
      if (activeVoters.every((p) => (agg.votedBy.get(p) ?? 0) >= 1)) {
        unanimousYes.push(item._id);
      } else if (activeVoters.every((p) => agg.votedBy.get(p) === 0)) {
        unanimousNo.push(item._id);
      }
    }
  }

  return { scores, topPicks, unanimousYes, unanimousNo };
}
