import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_CREDENTIAL_TTL_MS = 30 * 60 * 1000;
const IDLE_CREDENTIAL_TTL_MS = 30 * DAY_MS;

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const cascade = async (sessionId: Id<"sessions">) => {
      const [items, participants, votes] = await Promise.all([
        ctx.db
          .query("mediaItems")
          .withIndex("by_session_order", (q) => q.eq("sessionId", sessionId))
          .collect(),
        ctx.db
          .query("participants")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect(),
        ctx.db
          .query("votes")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect(),
      ]);
      await Promise.all([
        ...items.map((d) => ctx.db.delete(d._id)),
        ...participants.map((d) => ctx.db.delete(d._id)),
        ...votes.map((d) => ctx.db.delete(d._id)),
      ]);
      await ctx.db.delete(sessionId);
    };

    // Completed sessions past their 24h results window.
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", 0).lt("expiresAt", now))
      .collect();
    // Abandoned sessions (never completed) older than 24h.
    const all = await ctx.db.query("sessions").collect();
    const abandoned = all.filter(
      (s) => s.expiresAt === undefined && s.createdAt < now - DAY_MS
    );
    for (const session of [...expired, ...abandoned]) {
      await cascade(session._id);
    }

    // Credential GC: pending pins that never completed, and idle credentials
    // with no remaining sessions after 30 days (host just signs in again).
    const remaining = await ctx.db.query("sessions").collect();
    const referenced = new Set(remaining.map((s) => s.credentialId));
    const credentials = await ctx.db.query("plexCredentials").collect();
    for (const cred of credentials) {
      const isStalePending =
        cred.status === "pending" &&
        cred.createdAt < now - PENDING_CREDENTIAL_TTL_MS;
      const isIdle =
        !referenced.has(cred._id) &&
        cred.createdAt < now - IDLE_CREDENTIAL_TTL_MS;
      if (isStalePending || isIdle) await ctx.db.delete(cred._id);
    }
  },
});
