import { v, ConvexError } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  fetchResources,
  plexClientId,
  plexProduct,
  plexTvFetch,
  plexServerFetch,
  resolveServerConnection,
} from "./lib/plexApi";
import { newSecret } from "./lib/ids";
import { buildFilterParams, filtersValidator } from "./lib/library";

// ---------------------------------------------------------------------------
// Internal credential plumbing
// ---------------------------------------------------------------------------

export const insertPendingCredential = internalMutation({
  args: { pinId: v.number(), pinCode: v.string(), clientId: v.string() },
  handler: async (ctx, args) => {
    const authSecret = newSecret();
    const credentialId = await ctx.db.insert("plexCredentials", {
      ...args,
      authSecret,
      status: "pending",
      createdAt: Date.now(),
    });
    return { credentialId, authSecret };
  },
});

export const getCredential = internalQuery({
  args: { credentialId: v.id("plexCredentials"), authSecret: v.string() },
  handler: async (ctx, args): Promise<Doc<"plexCredentials"> | null> => {
    const cred = await ctx.db.get(args.credentialId);
    if (!cred || cred.authSecret !== args.authSecret) return null;
    return cred;
  },
});

export const markAuthenticated = internalMutation({
  args: {
    credentialId: v.id("plexCredentials"),
    plexToken: v.string(),
    access: v.union(v.literal("approved"), v.literal("waitlisted")),
    plexUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.credentialId, {
      status: "authenticated",
      plexToken: args.plexToken,
      access: args.access,
      plexUsername: args.plexUsername,
    });
  },
});

export const addToWaitlist = internalMutation({
  args: { plexUsername: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_plexUsername", (q) =>
        q.eq("plexUsername", args.plexUsername)
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("waitlist", { ...args, createdAt: Date.now() });
    }
  },
});

/**
 * Resolve a credential for an action, enforcing authSecret possession and —
 * unless `allowPending` — the access gate. Every host-side action goes
 * through this.
 */
async function requireCredential(
  ctx: ActionCtx,
  credentialId: Id<"plexCredentials">,
  authSecret: string,
  opts: { allowPending?: boolean } = {}
): Promise<Doc<"plexCredentials">> {
  const cred = await ctx.runQuery(internal.plex.getCredential, {
    credentialId,
    authSecret,
  });
  if (!cred) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Invalid credential" });
  }
  if (!opts.allowPending) {
    if (cred.status !== "authenticated" || !cred.plexToken) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not signed in" });
    }
    if (cred.access !== "approved") {
      throw new ConvexError({ code: "WAITLISTED", message: "Account is waitlisted" });
    }
  }
  return cred;
}

export { requireCredential };

// ---------------------------------------------------------------------------
// PIN auth flow
// ---------------------------------------------------------------------------

export const createPin = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    credentialId: Id<"plexCredentials">;
    authSecret: string;
    authUrl: string;
  }> => {
    const res = await plexTvFetch("/api/v2/pins?strong=true", { method: "POST" });
    if (!res.ok) {
      throw new ConvexError({
        code: "PLEX_ERROR",
        message: `plex.tv pin creation failed (${res.status})`,
      });
    }
    const pin = (await res.json()) as { id: number; code: string };
    const { credentialId, authSecret } = await ctx.runMutation(
      internal.plex.insertPendingCredential,
      { pinId: pin.id, pinCode: pin.code, clientId: plexClientId() }
    );
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const params = new URLSearchParams({
      clientID: plexClientId(),
      code: pin.code,
      "context[device][product]": plexProduct(),
      forwardUrl: `${siteUrl}/auth/callback`,
    });
    return {
      credentialId,
      authSecret,
      authUrl: `https://app.plex.tv/auth#?${params.toString()}`,
    };
  },
});

export const checkPin = action({
  args: { credentialId: v.id("plexCredentials"), authSecret: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ status: "pending" | "authenticated"; access?: "approved" | "waitlisted" }> => {
    const cred = await requireCredential(ctx, args.credentialId, args.authSecret, {
      allowPending: true,
    });
    if (cred.status === "authenticated") {
      return { status: "authenticated", access: cred.access };
    }

    const res = await plexTvFetch(`/api/v2/pins/${cred.pinId}`);
    if (!res.ok) {
      throw new ConvexError({
        code: "PLEX_ERROR",
        message: `plex.tv pin check failed (${res.status})`,
      });
    }
    const pin = (await res.json()) as { authToken: string | null };
    if (!pin.authToken) return { status: "pending" };

    // Access gate: the account must have access to the configured server.
    const allowedServerId = process.env.PLEX_SERVER_ID;
    let access: "approved" | "waitlisted" = "approved";
    if (allowedServerId) {
      const servers = await fetchResources(pin.authToken);
      access = servers.some((s) => s.clientIdentifier === allowedServerId)
        ? "approved"
        : "waitlisted";
    }

    let username: string | undefined;
    let email: string | undefined;
    try {
      const userRes = await plexTvFetch("/api/v2/user", { token: pin.authToken });
      if (userRes.ok) {
        const user = (await userRes.json()) as { username?: string; email?: string };
        username = user.username;
        email = user.email;
      }
    } catch {
      // profile fetch is best-effort
    }
    if (access === "waitlisted" && username) {
      await ctx.runMutation(internal.plex.addToWaitlist, {
        plexUsername: username,
        email,
      });
    }

    await ctx.runMutation(internal.plex.markAuthenticated, {
      credentialId: args.credentialId,
      plexToken: pin.authToken,
      access,
      plexUsername: username,
    });
    return { status: "authenticated", access };
  },
});

// ---------------------------------------------------------------------------
// Discovery for the create wizard
// ---------------------------------------------------------------------------

export const listServers = action({
  args: { credentialId: v.id("plexCredentials"), authSecret: v.string() },
  handler: async (ctx, args) => {
    const cred = await requireCredential(ctx, args.credentialId, args.authSecret);
    const servers = await fetchResources(cred.plexToken!);
    return servers.map((s) => ({
      name: s.name,
      clientIdentifier: s.clientIdentifier,
      owned: s.owned,
      relayOnly: !s.connections.some(
        (c) => c.protocol === "https" && !c.relay && !c.local
      ),
    }));
  },
});

async function resolveServer(accountToken: string, serverClientId: string) {
  const servers = await fetchResources(accountToken);
  const resource = servers.find((s) => s.clientIdentifier === serverClientId);
  if (!resource) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Server not found" });
  }
  return resolveServerConnection(resource, accountToken);
}

export const listLibraries = action({
  args: {
    credentialId: v.id("plexCredentials"),
    authSecret: v.string(),
    serverClientId: v.string(),
  },
  handler: async (ctx, args) => {
    const cred = await requireCredential(ctx, args.credentialId, args.authSecret);
    const conn = await resolveServer(cred.plexToken!, args.serverClientId);
    const data = (await plexServerFetch(conn.uri, "/library/sections", conn.token)) as {
      MediaContainer?: { Directory?: Array<{ key: string; title: string; type: string }> };
    };
    const sections = data.MediaContainer?.Directory ?? [];
    return sections
      .filter((s) => s.type === "movie" || s.type === "show")
      .map((s) => ({ key: s.key, title: s.title, type: s.type as "movie" | "show" }));
  },
});

export const previewFilters = action({
  args: {
    credentialId: v.id("plexCredentials"),
    authSecret: v.string(),
    serverClientId: v.string(),
    libraryKey: v.string(),
    mediaType: v.union(v.literal("movie"), v.literal("show")),
    filters: filtersValidator,
  },
  handler: async (ctx, args) => {
    const cred = await requireCredential(ctx, args.credentialId, args.authSecret);
    const conn = await resolveServer(cred.plexToken!, args.serverClientId);
    const type = args.mediaType === "movie" ? 1 : 2;

    const directory = async (kind: string) => {
      const data = (await plexServerFetch(
        conn.uri,
        `/library/sections/${args.libraryKey}/${kind}?type=${type}`,
        conn.token
      )) as { MediaContainer?: { Directory?: Array<{ key: string; title: string }> } };
      return (data.MediaContainer?.Directory ?? []).map((d) => ({
        key: d.key,
        title: d.title,
      }));
    };

    const count = async () => {
      const params = buildFilterParams(args.mediaType, args.filters);
      const data = (await plexServerFetch(
        conn.uri,
        `/library/sections/${args.libraryKey}/all?${params}&X-Plex-Container-Start=0&X-Plex-Container-Size=0`,
        conn.token
      )) as { MediaContainer?: { totalSize?: number; size?: number } };
      return data.MediaContainer?.totalSize ?? data.MediaContainer?.size ?? 0;
    };

    const [genres, contentRatings, matchCount] = await Promise.all([
      directory("genre"),
      directory("contentRating"),
      count(),
    ]);
    return { genres, contentRatings, matchCount, relay: conn.relay };
  },
});
