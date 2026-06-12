import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export async function getSessionByCode(
  ctx: QueryCtx,
  code: string
): Promise<Doc<"sessions"> | null> {
  return ctx.db
    .query("sessions")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

export async function requireSession(
  ctx: QueryCtx,
  code: string
): Promise<Doc<"sessions">> {
  const session = await getSessionByCode(ctx, code);
  if (!session) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Session not found" });
  }
  return session;
}

export async function requireHost(
  ctx: QueryCtx,
  code: string,
  hostKey: string
): Promise<Doc<"sessions">> {
  const session = await requireSession(ctx, code);
  if (session.hostKey !== hostKey) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Host key mismatch" });
  }
  return session;
}

export async function requireParticipant(
  ctx: QueryCtx,
  code: string,
  participantSecret: string
): Promise<{ session: Doc<"sessions">; participant: Doc<"participants"> }> {
  const session = await requireSession(ctx, code);
  const participant = await ctx.db
    .query("participants")
    .withIndex("by_session_secret", (q) =>
      q.eq("sessionId", session._id).eq("secret", participantSecret)
    )
    .unique();
  if (!participant) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Unknown participant" });
  }
  return { session, participant };
}
