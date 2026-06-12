"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { setSessionKeys } from "@/lib/storage";
import { errorCode, errorMessage } from "@/lib/errors";

export function JoinForm({ code }: { code: string }) {
  const join = useMutation(api.participants.join);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { participantSecret } = await join({ code, name });
      // Writing the secret notifies the session page via the storage store.
      setSessionKeys(code, { participantSecret });
    } catch (err) {
      setError(
        errorCode(err) === "NAME_TAKEN"
          ? "That name's taken — pick another!"
          : errorMessage(err)
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="space-y-2 text-center">
        <p className="text-5xl" aria-hidden>
          🍿
        </p>
        <h1 className="text-2xl font-bold">You&apos;re invited to movie night</h1>
        <p className="text-sm text-zinc-400">
          Pick a name so your friends know whose taste to blame.
        </p>
      </div>
      <form onSubmit={submit} className="w-full space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoFocus
          placeholder="Your name"
          aria-label="Display name"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg outline-none focus:border-amber-500"
        />
        {error && <p className="text-center text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="w-full rounded-full bg-amber-500 py-3 text-lg font-semibold text-zinc-950 disabled:opacity-40"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </form>
    </main>
  );
}
