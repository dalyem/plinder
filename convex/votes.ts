import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getSessionByCode, requireParticipant } from "./lib/guards";

const DAY_MS = 24 * 60 * 60 * 1000;

export const cast = mutation({
  args: {
    code: v.string(),
    participantSecret: v.string(),
    mediaItemId: v.id("mediaItems"),
    value: v.union(v.literal(0), v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    const { session, participant } = await requireParticipant(
      ctx,
      args.code,
      args.participantSecret
    );
    if (session.status !== "swiping") {
      throw new ConvexError({ code: "BAD_STATE", message: "Voting is not open" });
    }
    const item = await ctx.db.get(args.mediaItemId);
    if (!item || item.sessionId !== session._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Unknown card" });
    }

    // First-write-wins: double-taps and retries are idempotent no-ops.
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_participant_item", (q) =>
        q.eq("participantId", participant._id).eq("mediaItemId", args.mediaItemId)
      )
      .unique();
    if (existing) return { value: existing.value, duplicate: true };

    const myVotes = await ctx.db
      .query("votes")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();

    if (args.value === 2) {
      const used = myVotes.filter((vote) => vote.value === 2).length;
      if (used >= session.superLikesAllowed) {
        throw new ConvexError({
          code: "SUPERLIKE_BUDGET",
          message: "No super likes left",
        });
      }
    }

    await ctx.db.insert("votes", {
      sessionId: session._id,
      participantId: participant._id,
      mediaItemId: args.mediaItemId,
      value: args.value,
      createdAt: Date.now(),
    });

    // Finish detection — serializable mutations make this race-free.
    if (myVotes.length + 1 >= session.deckSize && participant.finishedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(participant._id, { finishedAt: now });
      const everyone = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      const allDone = everyone.every(
        (p) => p._id === participant._id || p.finishedAt !== undefined
      );
      if (allDone) {
        await ctx.db.patch(session._id, {
          status: "results",
          completedAt: now,
          expiresAt: now + DAY_MS,
        });
      }
    }
    return { value: args.value, duplicate: false };
  },
});

export const myProgress = query({
  args: { code: v.string(), participantSecret: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    if (!session) return null;
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session_secret", (q) =>
        q.eq("sessionId", session._id).eq("secret", args.participantSecret)
      )
      .unique();
    if (!participant) return null;
    const myVotes = await ctx.db
      .query("votes")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    return {
      votes: myVotes.map((vote) => ({
        mediaItemId: vote.mediaItemId,
        value: vote.value,
      })),
      superLikesUsed: myVotes.filter((vote) => vote.value === 2).length,
      finished: participant.finishedAt !== undefined,
    };
  },
});
