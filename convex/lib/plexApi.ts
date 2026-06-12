import { ConvexError } from "convex/values";

// ---------------------------------------------------------------------------
// Shared Plex / TMDB fetch helpers. Used only from Convex actions — tokens
// never leave the Convex deployment.
// ---------------------------------------------------------------------------

export function plexClientId(): string {
  const id = process.env.PLEX_CLIENT_IDENTIFIER;
  if (!id) throw new ConvexError({ code: "CONFIG", message: "PLEX_CLIENT_IDENTIFIER not set" });
  return id;
}

export function plexProduct(): string {
  return process.env.PLEX_PRODUCT ?? "Plinder";
}

export function plexHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Plex-Client-Identifier": plexClientId(),
    "X-Plex-Product": plexProduct(),
    "X-Plex-Version": "1.0",
    "X-Plex-Platform": "Web",
    "X-Plex-Device": "Plinder",
    "X-Plex-Device-Name": "Plinder",
  };
  if (token) headers["X-Plex-Token"] = token;
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function plexTvFetch(
  path: string,
  opts: { token?: string; method?: string } = {}
): Promise<Response> {
  return fetchWithTimeout(
    `https://plex.tv${path}`,
    { method: opts.method ?? "GET", headers: plexHeaders(opts.token) },
    15000
  );
}

export async function plexServerFetch(
  serverUri: string,
  path: string,
  token: string,
  timeoutMs = 20000
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${serverUri}${path}`,
      { headers: plexHeaders(token) },
      timeoutMs
    );
  } catch {
    throw new ConvexError({
      code: "PLEX_UNREACHABLE",
      message: "Could not reach the Plex server. Check that Remote Access is enabled.",
    });
  }
  if (!res.ok) {
    throw new ConvexError({
      code: "PLEX_ERROR",
      message: `Plex server responded ${res.status}`,
    });
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Server discovery via plex.tv resources
// ---------------------------------------------------------------------------

export type PlexResource = {
  name: string;
  clientIdentifier: string;
  provides: string;
  owned: boolean;
  accessToken?: string;
  connections: Array<{
    uri: string;
    protocol: string;
    local: boolean;
    relay: boolean;
  }>;
};

export async function fetchResources(accountToken: string): Promise<PlexResource[]> {
  const res = await plexTvFetch(
    "/api/v2/resources?includeHttps=1&includeRelay=1",
    { token: accountToken }
  );
  if (!res.ok) {
    throw new ConvexError({
      code: "PLEX_ERROR",
      message: `plex.tv resources responded ${res.status}`,
    });
  }
  const all = (await res.json()) as PlexResource[];
  return all.filter((r) => r.provides.split(",").includes("server"));
}

/**
 * Pick the best reachable connection for a server: direct remote HTTPS first,
 * relay as fallback (slow but works), LAN addresses last (unreachable from
 * the Convex cloud, kept only as a final attempt). Each candidate gets a
 * short reachability probe against /identity.
 */
export async function resolveServerConnection(
  resource: PlexResource,
  accountToken: string
): Promise<{ uri: string; token: string; relay: boolean }> {
  const token = resource.accessToken ?? accountToken;
  const https = resource.connections.filter((c) => c.protocol === "https");
  const candidates = [
    ...https.filter((c) => !c.relay && !c.local),
    ...https.filter((c) => c.relay),
    ...https.filter((c) => !c.relay && c.local),
  ];
  for (const candidate of candidates) {
    try {
      const res = await fetchWithTimeout(
        `${candidate.uri}/identity`,
        { headers: plexHeaders(token) },
        candidate.relay ? 10000 : 6000
      );
      if (res.ok) return { uri: candidate.uri, token, relay: candidate.relay };
    } catch {
      // try the next connection
    }
  }
  throw new ConvexError({
    code: "PLEX_UNREACHABLE",
    message:
      "None of the server's connections are reachable. Check that Plex Remote Access is enabled.",
  });
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

export async function tmdbFetch(path: string): Promise<unknown | null> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return null; // enrichment is optional — degrade, never fail
  try {
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
      10000
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
