# Plinder 🎬

Tinder-style group voting for your Plex library. The host signs in with Plex,
builds a randomized deck of movies or shows, and shares a link. Friends join
from their phones with just a name, everyone swipes (left = no, right = yes,
up = super like), and Plinder crowns the group's pick. Everything is
ephemeral — results live for 24 hours after a session ends, then the data is
deleted.

## How it works

- **Next.js (App Router) on Vercel** for the UI.
- **Convex** for everything backend: realtime lobby/progress/results
  (reactive queries), votes (serializable mutations — double votes and
  finish-detection are race-free), Plex/TMDB fetches (actions), and the 24h
  expiry sweep (cron).
- **Plex** is only consulted twice: once at sign-in and once at session
  creation, where a single query returns N random items matching the host's
  filters (`sort=random&includeGuids=1`). The library is never crawled,
  synced, or stored.
- **TMDB** provides all display metadata (summary, cast, ratings, trailer)
  via direct ID lookup from the `tmdb://` guid Plex returns — and posters are
  hotlinked from TMDB's CDN, so your Plex server and home connection serve
  zero image traffic during gameplay.
- **No accounts.** The host's Plex token lives only inside Convex. Hosts and
  guests are identified by random secrets in localStorage; sessions by
  unguessable codes.
- **Access gate:** anyone can attempt Plex sign-in, but only accounts with
  access to the server named in `PLEX_SERVER_ID` may host. Everyone else
  lands on a waitlist (recorded in the `waitlist` table).

## Local development

```bash
npm install
npx convex dev        # starts/links a Convex dev deployment + codegen
npm run dev           # Next.js on http://localhost:3000
```

Set the Convex environment variables (Convex dashboard → Settings →
Environment Variables, or `npx convex env set`):

| Variable | Value |
| --- | --- |
| `PLEX_CLIENT_IDENTIFIER` | A stable UUID you generate once (`uuidgen`). Must never change — Plex ties pins and tokens to it. |
| `PLEX_PRODUCT` | `Plinder` (shows up in your Plex authorized devices) |
| `SITE_URL` | Your app origin, e.g. `http://localhost:3000` or the Vercel URL — used for the Plex auth redirect |
| `PLEX_SERVER_ID` | Your server's machine identifier (the access gate). Find it at `https://plex.tv/api/v2/resources` with your token, or Plex Web → Settings → General. Leave unset to allow any Plex account (dev only). |
| `TMDB_API_TOKEN` | Free v4 "API Read Access Token" from themoviedb.org → Settings → API |

Next.js needs `NEXT_PUBLIC_CONVEX_URL` in `.env.local` (written automatically
by `npx convex dev`).

### Seeding a fake session (no Plex needed)

```bash
npx convex run dev:seedSession        # returns { code, hostKey, hostSecret }
# open http://localhost:3000/s/<code> on a couple of devices and play
```

## Deploying

1. **Convex:** `npx convex deploy` (or let Vercel do it, below). Set the env
   vars above on the **production** deployment, with `SITE_URL` set to your
   Vercel URL.
2. **Vercel:** import the repo, set
   - `NEXT_PUBLIC_CONVEX_URL` = `https://<deployment>.convex.cloud`
   - `CONVEX_DEPLOY_KEY` = production deploy key (Convex dashboard)
   - Build command: `npx convex deploy --cmd 'npm run build'`
3. Your Plex server needs **Remote Access** enabled (Settings → Remote
   Access) so Convex can reach its `*.plex.direct` endpoint. Nothing else is
   exposed; guests' phones never touch Plex.

## Session lifecycle

```
lobby ──host starts──▶ swiping ──everyone finishes (or host ends)──▶ results ──24h──▶ deleted
```

Abandoned sessions (never finished) are swept 24h after creation. A cron runs
every 15 minutes; deletes cascade to the deck, participants, and votes.

## Scoring

Right swipe = 1 point, super like = 2, left = 0. Super likes per person scale
with deck size: `max(1, floor(sqrt(N)/2))` → 10–15 options: 1, 20–30: 2,
50: 3, 100: 5. Ties surface a host-only "pick a random winner" button; the
random pick is persisted so every screen shows the same winner.
