import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { newSecret, newSessionCode } from "./lib/ids";
import { superLikesFor } from "./lib/library";
import { requireSession } from "./lib/guards";

/** Dev-only: backdate a session's expiry so the cleanup cron can be tested. */
export const expireSession = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.code);
    await ctx.db.patch(session._id, { expiresAt: Date.now() - 1 });
  },
});

/**
 * Dev-only seeding (internal — unreachable from clients). Creates a session
 * with a fake 3-item deck so the lobby/vote/results machinery can be
 * exercised without a Plex server: `npx convex run dev:seedSession`.
 */
export const seedSession = internalMutation({
  args: {},
  handler: async (ctx) => {
    const code = newSessionCode();
    const hostKey = newSecret();
    const hostSecret = newSecret();
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      code,
      hostKey,
      credentialId: await ctx.db.insert("plexCredentials", {
        pinId: 0,
        pinCode: "seed",
        clientId: "seed",
        authSecret: newSecret(),
        status: "authenticated",
        access: "approved",
        plexToken: "seed",
        createdAt: now,
      }),
      plexServerUri: "https://seed.invalid",
      plexServerToken: "seed",
      libraryKey: "1",
      mediaType: "movie",
      filters: {},
      deckSize: 3,
      superLikesAllowed: superLikesFor(3),
      status: "lobby",
      createdAt: now,
    });
    const titles = ["Alpha Movie", "Beta Movie", "Gamma Movie"];
    const itemIds = [];
    for (let order = 0; order < titles.length; order++) {
      itemIds.push(
        await ctx.db.insert("mediaItems", {
          sessionId,
          order,
          ratingKey: `seed-${order}`,
          title: titles[order],
          year: 2000 + order,
          genres: ["Drama"],
          directors: ["Seed Director"],
          cast: ["Actor One", "Actor Two"],
        })
      );
    }
    await ctx.db.insert("participants", {
      sessionId,
      name: "Host",
      secret: hostSecret,
      isHost: true,
      joinedAt: now,
    });
    return { code, hostKey, hostSecret, itemIds };
  },
});
