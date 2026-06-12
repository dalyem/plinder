"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/convex/_generated/api";
import { GonePage } from "@/components/session/GonePage";
import { ResultsBoard } from "@/components/results/ResultsBoard";

/** Big-screen spectator view — pure public-by-code queries, never joins. */
export default function TvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const session = useQuery(api.sessions.get, { code });
  const roster = useQuery(api.sessions.roster, { code });

  if (session === undefined || roster === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center text-2xl text-zinc-400">
        Loading…
      </main>
    );
  }
  if (session === null) return <GonePage />;

  if (session.status === "results") {
    return <ResultsBoard code={code} big />;
  }

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/s/${code}` : "";

  if (session.status === "lobby") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-10 py-12 text-center">
        <h1 className="text-5xl font-bold">
          🎬 Movie night is gathering…
        </h1>
        <div className="flex items-center gap-10">
          <div className="rounded-2xl bg-white p-5">
            <QRCodeSVG value={url} size={220} aria-label="QR code to join" />
          </div>
          <div className="space-y-3 text-left">
            <p className="text-xl text-zinc-300">Scan to join, or open</p>
            <p className="font-mono text-2xl text-amber-400">{url}</p>
            <p className="text-zinc-400">
              {session.deckSize}{" "}
              {session.mediaType === "show" ? "shows" : "movies"} ·{" "}
              {session.superLikesAllowed} super like
              {session.superLikesAllowed === 1 ? "" : "s"} each
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {roster.map((p) => (
            <span
              key={p.participantId}
              className="rounded-full bg-zinc-800 px-5 py-2 text-xl"
            >
              {p.name}
              {p.isHost && <span className="ml-2 text-sm text-amber-400">host</span>}
            </span>
          ))}
          {roster.length === 0 && (
            <span className="text-zinc-500">Nobody here yet…</span>
          )}
        </div>
      </main>
    );
  }

  // swiping — live progress board
  const sorted = [...roster].sort((a, b) => b.votesCast - a.votesCast);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-10 py-12">
      <h1 className="text-center text-4xl font-bold">Swiping in progress…</h1>
      <ul className="space-y-5">
        {sorted.map((p) => (
          <li key={p.participantId} className="space-y-2">
            <div className="flex justify-between text-xl">
              <span>
                {p.name}
                {p.isHost && <span className="ml-2 text-sm text-amber-400">host</span>}
              </span>
              <span className="text-zinc-400">
                {p.finished ? "✅ done" : `${p.votesCast} / ${session.deckSize}`}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full transition-all duration-500 ${p.finished ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{
                  width: `${Math.min(100, (p.votesCast / session.deckSize) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-center text-zinc-500">
        Results appear here the moment everyone finishes.
      </p>
    </main>
  );
}
