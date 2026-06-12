import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Plex token NEVER lives on sessions' public surface.
  plexCredentials: defineTable({
    pinId: v.number(),
    pinCode: v.string(),
    clientId: v.string(),
    authSecret: v.string(),
    status: v.union(v.literal("pending"), v.literal("authenticated")),
    access: v.optional(v.union(v.literal("approved"), v.literal("waitlisted"))),
    plexToken: v.optional(v.string()),
    plexUsername: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_authSecret", ["authSecret"]),

  // Accounts that signed in without access to the configured server.
  waitlist: defineTable({
    plexUsername: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_plexUsername", ["plexUsername"]),

  sessions: defineTable({
    code: v.string(),
    hostKey: v.string(),
    credentialId: v.id("plexCredentials"),
    plexServerUri: v.string(),
    plexServerToken: v.string(),
    libraryKey: v.string(),
    mediaType: v.union(v.literal("movie"), v.literal("show")),
    filters: v.object({
      genres: v.optional(v.array(v.string())),
      genreLabels: v.optional(v.array(v.string())),
      unwatchedOnly: v.optional(v.boolean()),
      contentRatings: v.optional(v.array(v.string())),
      yearMin: v.optional(v.number()),
      yearMax: v.optional(v.number()),
      runtimeMinMin: v.optional(v.number()),
      runtimeMaxMin: v.optional(v.number()),
    }),
    deckSize: v.number(),
    superLikesAllowed: v.number(),
    status: v.union(
      v.literal("lobby"),
      v.literal("swiping"),
      v.literal("results")
    ),
    tieWinnerItemId: v.optional(v.id("mediaItems")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_expiresAt", ["expiresAt"]),

  // Snapshot of the N deck items only — zero Plex/TMDB calls during play.
  mediaItems: defineTable({
    sessionId: v.id("sessions"),
    order: v.number(),
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
  }).index("by_session_order", ["sessionId", "order"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(),
    secret: v.string(),
    isHost: v.boolean(),
    joinedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_secret", ["sessionId", "secret"]),

  votes: defineTable({
    sessionId: v.id("sessions"),
    participantId: v.id("participants"),
    mediaItemId: v.id("mediaItems"),
    value: v.union(v.literal(0), v.literal(1), v.literal(2)),
    createdAt: v.number(),
  })
    .index("by_participant_item", ["participantId", "mediaItemId"])
    .index("by_session", ["sessionId"])
    .index("by_participant", ["participantId"]),
});
