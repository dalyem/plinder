"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredAuth } from "@/lib/storage";

const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

type PollState = "polling" | "waitlisted" | "timeout" | "error";

export default function AuthCallback() {
  const router = useRouter();
  const checkPin = useAction(api.plex.checkPin);
  const { loaded, auth } = useStoredAuth();
  const [state, setState] = useState<PollState>("polling");
  const stopped = useRef(false);

  useEffect(() => {
    if (!loaded || !auth) return;
    const startedAt = Date.now();
    stopped.current = false;

    const poll = async () => {
      while (!stopped.current) {
        if (Date.now() - startedAt > TIMEOUT_MS) {
          setState("timeout");
          return;
        }
        try {
          const result = await checkPin({
            credentialId: auth.credentialId as Id<"plexCredentials">,
            authSecret: auth.authSecret,
          });
          if (result.status === "authenticated") {
            if (result.access === "approved") {
              router.replace("/create");
            } else {
              setState("waitlisted");
            }
            return;
          }
        } catch {
          setState("error");
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };
    void poll();
    return () => {
      stopped.current = true;
    };
  }, [loaded, auth, checkPin, router]);

  const noAuth = loaded && !auth;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      {!noAuth && state === "polling" && (
        <>
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500"
            aria-label="Waiting for Plex sign-in"
          />
          <p className="text-zinc-400">Finishing your Plex sign-in…</p>
        </>
      )}
      {!noAuth && state === "waitlisted" && (
        <div className="max-w-md space-y-4">
          <p className="text-5xl" aria-hidden>
            💌
          </p>
          <h1 className="text-2xl font-bold">You&apos;re on the wait list</h1>
          <p className="text-zinc-400">
            Plinder is invite-only right now. You&apos;ve been added to the
            wait list — thanks for reaching out!
          </p>
        </div>
      )}
      {(noAuth || state === "timeout" || state === "error") && (
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold">
            {state === "timeout" ? "Sign-in timed out" : "Sign-in hiccup"}
          </h1>
          <p className="text-zinc-400">
            {noAuth
              ? "We couldn't find a sign-in in progress on this device."
              : "We couldn't confirm your Plex sign-in."}{" "}
            Head back and try again.
          </p>
          <Link
            href="/"
            className="inline-block rounded-full bg-amber-500 px-6 py-3 font-semibold text-zinc-950"
          >
            Back to start
          </Link>
        </div>
      )}
    </main>
  );
}
