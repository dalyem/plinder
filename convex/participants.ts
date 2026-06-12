import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getSessionByCode, requireSession } from "./lib/guards";
import { newSecret } from "./lib/ids";

const MAX_NAME_LENGTH = 24;
const MAX_PARTICIPANTS = 30;

export const join = mutation({
  args: { code: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.code);
    if (session.status === "results") {
      throw new ConvexError({ code: "SESSION_ENDED", message: "Voting has ended" });
    }
    const name = args.name.trim().slice(0, MAX_NAME_LENGTH);
    if (name.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a name" });
    }
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    if (existing.length >= MAX_PARTICIPANTS) {
      throw new ConvexError({ code: "SESSION_FULL", message: "Session is full" });
    }
    if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "NAME_TAKEN", message: "That name is taken" });
    }
    const secret = newSecret();
    const participantId = await ctx.db.insert("participants", {
      sessionId: session._id,
      name,
      secret,
      isHost: false,
      joinedAt: Date.now(),
    });
    return { participantId, participantSecret: secret };
  },
});

export const me = query({
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
    return {
      participantId: participant._id,
      name: participant.name,
      isHost: participant.isHost,
      finished: participant.finishedAt !== undefined,
    };
  },
});
