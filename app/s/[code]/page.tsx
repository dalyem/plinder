"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useStoredSessionKeys } from "@/lib/storage";
import { GonePage } from "@/components/session/GonePage";
import { JoinForm } from "@/components/lobby/JoinForm";
import { Lobby } from "@/components/lobby/Lobby";
import { SwipeScreen } from "@/components/session/SwipeScreen";
import { WaitingForOthers } from "@/components/session/WaitingForOthers";
import { ResultsBoard } from "@/components/results/ResultsBoard";

export default function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { loaded, keys } = useStoredSessionKeys(code);

  const session = useQuery(api.sessions.get, { code });
  const roster = useQuery(api.sessions.roster, { code });
  const me = useQuery(
    api.participants.me,
    loaded && keys?.participantSecret
      ? { code, participantSecret: keys.participantSecret }
      : "skip"
  );
  const verifyHost = useQuery(
    api.sessions.verifyHost,
    loaded && keys?.hostKey ? { code, hostKey: keys.hostKey } : "skip"
  );
  const progress = useQuery(
    api.votes.myProgress,
    loaded && keys?.participantSecret
      ? { code, participantSecret: keys.participantSecret }
      : "skip"
  );

  if (!loaded || session === undefined) {
    return <Loading />;
  }
  if (session === null) {
    return <GonePage />;
  }

  const hostKey = verifyHost?.isHost ? keys?.hostKey : undefined;

  // Results are public to anyone with the link, joined or not.
  if (session.status === "results") {
    return <ResultsBoard code={code} hostKey={hostKey} />;
  }

  // Not joined (or stale secret) → name prompt. JoinForm writes the secret to
  // storage, which re-renders this page via the storage subscription.
  if (!keys?.participantSecret || me === null) {
    return <JoinForm code={code} />;
  }
  if (me === undefined || roster === undefined) {
    return <Loading />;
  }

  if (session.status === "lobby") {
    return (
      <Lobby
        code={code}
        session={session}
        roster={roster}
        hostKey={hostKey}
        myName={me.name}
      />
    );
  }

  // status === "swiping"
  const finished =
    progress?.finished ||
    (progress != null && progress.votes.length >= session.deckSize);
  if (finished) {
    return (
      <WaitingForOthers
        code={code}
        session={session}
        roster={roster}
        hostKey={hostKey}
      />
    );
  }
  return (
    <SwipeScreen
      code={code}
      session={session}
      participantSecret={keys.participantSecret}
    />
  );
}

function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500"
        aria-label="Loading"
      />
    </main>
  );
}
