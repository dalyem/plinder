import { v, ConvexError } from "convex/values";
import {
  action,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireCredential } from "./plex";
import {
  fetchResources,
  plexServerFetch,
  resolveServerConnection,
} from "./lib/plexApi";
import {
  buildFilterParams,
  filtersValidator,
  superLikesFor,
  type SessionFilters,
} from "./lib/library";
import { fetchTmdbDetails, mapWithConcurrency } from "./lib/tmdb";
import { newSecret, newSessionCode } from "./lib/ids";
import { getSessionByCode, requireHost } from "./lib/guards";
import { computeScores } from "./lib/score";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DECK = 200;

type PlexItem = {
  ratingKey: string;
  title: string;
  year?: number;
  duration?: number; // ms
  contentRating?: string;
  Guid?: Array<{ id: string }>;
};

type DeckItem = {
  ratingKey: string;
  tmdbId?: number;
  title: string;
  year?: number;
  runtimeMin?: number;
  contentRating?: string;
  tmdbRating?: number;
  summary?: string;
  genres: string[];
  directors: string[];
  cast: string[];
  posterPath?: string;
  backdropPath?: string;
  trailerKey?: string;
};

// ---------------------------------------------------------------------------
// Create: the only Plex library read in the whole app. Pull N random items,
// enrich from TMDB, snapshot — nothing else is ever read or stored.
// ---------------------------------------------------------------------------

export const create = action({
  args: {
    credentialId: v.id("plexCredentials"),
    authSecret: v.string(),
    serverClientId: v.string(),
    libraryKey: v.string(),
    mediaType: v.union(v.literal("movie"), v.literal("show")),
    count: v.number(),
    filters: filtersValidator,
    hostName: v.string(),
  },
  handler: async (ctx, args) => {
    const cred = await requireCredential(ctx, args.credentialId, args.authSecret);
    const requested = Math.floor(args.count);
    if (requested < 2 || requested > MAX_DECK) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Deck size must be between 2 and ${MAX_DECK}`,
      });
    }

    const servers = await fetchResources(cred.plexToken!);
    const resource = servers.find(
      (s) => s.clientIdentifier === args.serverClientId
    );
    if (!resource) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Server not found" });
    }
    const conn = await resolveServerConnection(resource, cred.plexToken!);

    // Over-fetch when a runtime filter is set; duration filtering happens here.
    const hasRuntimeFilter =
      args.filters.runtimeMinMin !== undefined ||
      args.filters.runtimeMaxMin !== undefined;
    const fetchSize = hasRuntimeFilter ? requested * 3 : requested;
    const params = buildFilterParams(args.mediaType, args.filters);
    const data = (await plexServerFetch(
      conn.uri,
      `/library/sections/${args.libraryKey}/all?${params}&sort=random&includeGuids=1` +
        `&X-Plex-Container-Start=0&X-Plex-Container-Size=${fetchSize}`,
      conn.token,
      30000
    )) as { MediaContainer?: { Metadata?: PlexItem[] } };

    let plexItems = data.MediaContainer?.Metadata ?? [];
    if (hasRuntimeFilter) {
      plexItems = plexItems.filter((item) => {
        if (item.duration === undefined) return true;
        const min = Math.round(item.duration / 60000);
        if (args.filters.runtimeMinMin !== undefined && min < args.filters.runtimeMinMin)
          return false;
        if (args.filters.runtimeMaxMin !== undefined && min > args.filters.runtimeMaxMin)
          return false;
        return true;
      });
    }
    plexItems = plexItems.slice(0, requested);
    if (plexItems.length < 2) {
      throw new ConvexError({
        code: "TOO_FEW_MATCHES",
        message: "Fewer than 2 items match those filters — loosen them and try again.",
      });
    }

    // TMDB enrichment, ~5 concurrent. Failures degrade to Plex basics.
    const deck: DeckItem[] = await mapWithConcurrency(plexItems, 5, async (item) => {
      const tmdbGuid = (item.Guid ?? []).find((g) => g.id.startsWith("tmdb://"));
      const tmdbId = tmdbGuid ? Number(tmdbGuid.id.slice("tmdb://".length)) : undefined;
      const base: DeckItem = {
        ratingKey: item.ratingKey,
        tmdbId: Number.isFinite(tmdbId) ? tmdbId : undefined,
        title: item.title,
        year: item.year,
        runtimeMin: item.duration ? Math.round(item.duration / 60000) : undefined,
        contentRating: item.contentRating,
        genres: [],
        directors: [],
        cast: [],
      };
      if (base.tmdbId === undefined) return base;
      const enriched = await fetchTmdbDetails(args.mediaType, base.tmdbId);
      if (!enriched) return base;
      return {
        ...base,
        summary: enriched.summary,
        genres: enriched.genres,
        runtimeMin: enriched.runtimeMin ?? base.runtimeMin,
        tmdbRating: enriched.tmdbRating,
        cast: enriched.cast,
        directors: enriched.directors,
        posterPath: enriched.posterPath,
        backdropPath: enriched.backdropPath,
        trailerKey: enriched.trailerKey,
      };
    });

    const result: {
      code: string;
      hostKey: string;
      participantSecret: string;
      deckSize: number;
      superLikesAllowed: number;
    } = await ctx.runMutation(internal.sessions.insert, {
      credentialId: args.credentialId,
      plexServerUri: conn.uri,
      plexServerToken: conn.token,
      libraryKey: args.libraryKey,
      mediaType: args.mediaType,
      filters: args.filters,
      hostName: args.hostName,
      deck,
    });
    return result;
  },
});

export const insert = internalMutation({
  args: {
    credentialId: v.id("plexCredentials"),
    plexServerUri: v.string(),
    plexServerToken: v.string(),
    libraryKey: v.string(),
    mediaType: v.union(v.literal("movie"), v.literal("show")),
    filters: filtersValidator,
    hostName: v.string(),
    deck: v.array(
      v.object({
        ratingKey: v.string(),
        tmdbId: v.optional(v.number()),
        title: v.string(),
        year: v.optional(v.number()),
        runtimeMin: v.optional(v.number()),
        contentRating: v.optional(v.string()),
        tmdbRating: v.optional(v.number()),
        summary: v.optional(v.string()),
        genres: v.array(v.string()),
        directors: v.array(v.string()),
        cast: v.array(v.string()),
        posterPath: v.optional(v.string()),
        backdropPath: v.optional(v.string()),
        trailerKey: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let code = newSessionCode();
    while (await getSessionByCode(ctx, code)) code = newSessionCode();
    const hostKey = newSecret();
    const participantSecret = newSecret();
    const deckSize = args.deck.length;
    const superLikesAllowed = superLikesFor(deckSize);
    const now = Date.now();

    const sessionId = await ctx.db.insert("sessions", {
      code,
      hostKey,
      credentialId: args.credentialId,
      plexServerUri: args.plexServerUri,
      plexServerToken: args.plexServerToken,
      libraryKey: args.libraryKey,
      mediaType: args.mediaType,
      filters: args.filters as SessionFilters,
      deckSize,
      superLikesAllowed,
      status: "lobby",
      createdAt: now,
    });
    await Promise.all(
      args.deck.map((item, order) =>
        ctx.db.insert("mediaItems", { sessionId, order, ...item })
      )
    );
    await ctx.db.insert("participants", {
      sessionId,
      name: args.hostName,
      secret: participantSecret,
      isHost: true,
      joinedAt: now,
    });
    return { code, hostKey, participantSecret, deckSize, superLikesAllowed };
  },
});

// ---------------------------------------------------------------------------
// Public, sanitized reads — never the raw session doc.
// ---------------------------------------------------------------------------

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    if (!session) return null;
    return {
      status: session.status,
      mediaType: session.mediaType,
      deckSize: session.deckSize,
      superLikesAllowed: session.superLikesAllowed,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
      tieWinnerItemId: session.tieWinnerItemId,
    };
  },
});

export const roster = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    if (!session) return [];
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    return Promise.all(
      participants.map(async (p) => {
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_participant", (q) => q.eq("participantId", p._id))
          .collect();
        return {
          participantId: p._id,
          name: p.name,
          isHost: p.isHost,
          finished: p.finishedAt !== undefined,
          votesCast: votes.length,
          joinedAt: p.joinedAt,
        };
      })
    );
  },
});

export const verifyHost = query({
  args: { code: v.string(), hostKey: v.string() },
  handler: async (ctx, args) => {
    const session = await getSessionByCode(ctx, args.code);
    return { isHost: session !== null && session.hostKey === args.hostKey };
  },
});

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

export const start = mutation({
  args: { code: v.string(), hostKey: v.string() },
  handler: async (ctx, args) => {
    const session = await requireHost(ctx, args.code, args.hostKey);
    if (session.status !== "lobby") {
      throw new ConvexError({ code: "BAD_STATE", message: "Session already started" });
    }
    await ctx.db.patch(session._id, { status: "swiping", startedAt: Date.now() });
  },
});

export const endVoting = mutation({
  args: { code: v.string(), hostKey: v.string() },
  handler: async (ctx, args) => {
    const session = await requireHost(ctx, args.code, args.hostKey);
    if (session.status !== "swiping") {
      throw new ConvexError({ code: "BAD_STATE", message: "Session is not in voting" });
    }
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "results",
      completedAt: now,
      expiresAt: now + DAY_MS,
    });
  },
});

export const pickRandomWinner = mutation({
  args: { code: v.string(), hostKey: v.string() },
  handler: async (ctx, args): Promise<Id<"mediaItems"> | null> => {
    const session = await requireHost(ctx, args.code, args.hostKey);
    if (session.status !== "results") {
      throw new ConvexError({ code: "BAD_STATE", message: "No results yet" });
    }
    if (session.tieWinnerItemId) return session.tieWinnerItemId;
    const { topPicks } = await computeScores(ctx, session);
    if (topPicks.length < 2) {
      throw new ConvexError({ code: "BAD_STATE", message: "There is no tie to break" });
    }
    const winner = topPicks[Math.floor(Math.random() * topPicks.length)];
    await ctx.db.patch(session._id, { tieWinnerItemId: winner });
    return winner;
  },
});
