"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { setAuth } from "@/lib/storage";
import { errorMessage } from "@/lib/errors";

export default function Landing() {
  const createPin = useAction(api.plex.createPin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const { credentialId, authSecret, authUrl } = await createPin();
      setAuth({ credentialId, authSecret });
      window.location.href = authUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="space-y-4">
        <p className="text-6xl" aria-hidden>
          🎬
        </p>
        <h1 className="text-5xl font-bold tracking-tight">Plinder</h1>
        <p className="mx-auto max-w-md text-lg text-zinc-400">
          Swipe with friends to pick tonight&apos;s movie from your Plex
          library. Host a round, text the link, everyone votes from their
          phone.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={signIn}
          disabled={busy}
          className="rounded-full bg-amber-500 px-8 py-4 text-lg font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Opening Plex…" : "Sign in with Plex to host"}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <p className="max-w-xs text-sm text-zinc-500">
          Joining a movie night? Just open the link your host sent you — no
          account needed.
        </p>
      </div>

      <ol className="grid max-w-2xl gap-4 text-left text-sm text-zinc-400 sm:grid-cols-3">
        <li className="rounded-xl border border-zinc-800 p-4">
          <span className="font-semibold text-zinc-200">1 · Host a round</span>
          <br />
          Pick a library, filters, and how many titles to shuffle in.
        </li>
        <li className="rounded-xl border border-zinc-800 p-4">
          <span className="font-semibold text-zinc-200">2 · Share the link</span>
          <br />
          Friends join from their phones with just a name.
        </li>
        <li className="rounded-xl border border-zinc-800 p-4">
          <span className="font-semibold text-zinc-200">3 · Swipe & watch</span>
          <br />
          Right for yes, left for no, super-like the must-see. Best pick wins.
        </li>
      </ol>
    </main>
  );
}
