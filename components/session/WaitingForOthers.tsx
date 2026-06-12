"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { RosterEntry, SessionView } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

export function WaitingForOthers({
  code,
  session,
  roster,
  hostKey,
}: {
  code: string;
  session: SessionView;
  roster: RosterEntry[];
  hostKey?: string;
}) {
  const endVoting = useMutation(api.sessions.endVoting);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...roster].sort((a, b) => b.votesCast - a.votesCast);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-1 text-center">
        <p className="text-5xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-2xl font-bold">You&apos;re done!</h1>
        <p className="text-sm text-zinc-400">
          Results appear the moment everyone finishes.
        </p>
      </header>

      <ul className="space-y-3">
        {sorted.map((p) => (
          <li key={p.participantId} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                {p.name}
                {p.isHost && <span className="ml-1 text-xs text-amber-400">host</span>}
              </span>
              <span className="text-zinc-500">
                {p.finished ? "done" : `${p.votesCast} / ${session.deckSize}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full transition-all ${p.finished ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{
                  width: `${Math.min(100, (p.votesCast / session.deckSize) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {hostKey && (
        <div className="space-y-2">
          {confirming ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full border border-zinc-700 py-3 text-sm font-semibold"
              >
                Keep waiting
              </button>
              <button
                onClick={() =>
                  endVoting({ code, hostKey }).catch((e) => setError(errorMessage(e)))
                }
                className="flex-1 rounded-full bg-rose-600 py-3 text-sm font-semibold"
              >
                End now — count votes so far
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-full border border-zinc-700 py-3 text-sm font-semibold text-zinc-300"
            >
              End voting early
            </button>
          )}
          {error && <p className="text-center text-sm text-rose-400">{error}</p>}
        </div>
      )}
    </main>
  );
}
