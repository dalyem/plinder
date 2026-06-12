"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "@/convex/_generated/api";
import type { RosterEntry, SessionView } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

export function Lobby({
  code,
  session,
  roster,
  hostKey,
  myName,
}: {
  code: string;
  session: SessionView;
  roster: RosterEntry[];
  hostKey?: string;
  myName?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-1 text-center">
        <h1 className="text-3xl font-bold">Movie night lobby</h1>
        <p className="text-sm text-zinc-400">
          {session.deckSize} {session.mediaType === "show" ? "shows" : "movies"}{" "}
          in the deck · {session.superLikesAllowed} super like
          {session.superLikesAllowed === 1 ? "" : "s"} each
        </p>
        {myName && <p className="text-sm text-zinc-500">You&apos;re in as {myName}</p>}
      </header>

      <ShareCard code={code} isHost={Boolean(hostKey)} />
      <LobbyRoster roster={roster} />

      {hostKey ? (
        <HostStart code={code} hostKey={hostKey} count={roster.length} />
      ) : (
        <p className="text-center text-sm text-zinc-500">
          Waiting for the host to start…
        </p>
      )}
    </main>
  );
}

export function ShareCard({ code, isHost }: { code: string; isHost: boolean }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/s/${code}` : "";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pick a movie with me", url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-white p-2">
          <QRCodeSVG value={url} size={96} aria-label="QR code to join" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate font-mono text-sm text-zinc-300">{url}</p>
          <button
            onClick={share}
            className="w-full rounded-full bg-amber-500 py-2 text-sm font-semibold text-zinc-950"
          >
            {copied ? "Copied!" : "Share link"}
          </button>
          {isHost && (
            <a
              href={`/s/${code}/tv`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-zinc-500 underline"
            >
              Open TV view ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function LobbyRoster({ roster }: { roster: RosterEntry[] }) {
  const sorted = [...roster].sort((a, b) => a.joinedAt - b.joinedAt);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">
        Who&apos;s here ({roster.length})
      </h2>
      <ul className="flex flex-wrap gap-2">
        <AnimatePresence>
          {sorted.map((p) => (
            <motion.li
              key={p.participantId}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-sm"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              {p.name}
              {p.isHost && <span className="text-xs text-amber-400">host</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function HostStart({
  code,
  hostKey,
  count,
}: {
  code: string;
  hostKey: string;
  count: number;
}) {
  const start = useMutation(api.sessions.start);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        onClick={() => start({ code, hostKey }).catch((e) => setError(errorMessage(e)))}
        className="w-full rounded-full bg-emerald-500 py-4 text-lg font-bold text-zinc-950 transition hover:bg-emerald-400"
      >
        Start session
      </button>
      {count < 2 && (
        <p className="text-center text-xs text-zinc-500">
          You can start solo, but it&apos;s more fun with friends in the lobby.
        </p>
      )}
      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}
