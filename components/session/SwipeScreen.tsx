"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DeckItem, SessionView, VoteValue } from "@/lib/types";
import { SwipeCard, type SwipeCardHandle } from "@/components/swipe/SwipeCard";
import { VoteButtons } from "@/components/swipe/VoteButtons";
import { DetailSheet } from "@/components/swipe/DetailSheet";
import { PosterImage } from "@/components/media/PosterImage";
import { errorCode } from "@/lib/errors";

export function SwipeScreen({
  code,
  session,
  participantSecret,
}: {
  code: string;
  session: SessionView;
  participantSecret: string;
}) {
  const deck = useQuery(api.media.deck, { code });
  const progress = useQuery(api.votes.myProgress, { code, participantSecret });
  const castVote = useMutation(api.votes.cast);

  // Optimistic local votes layered over the server's; merged by item id so
  // nothing double-counts when the server catches up.
  const [localVotes, setLocalVotes] = useState<Map<string, VoteValue>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<DeckItem | null>(null);
  const cardRef = useRef<SwipeCardHandle>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merged = useMemo(() => {
    const map = new Map<string, VoteValue>();
    for (const vote of progress?.votes ?? []) map.set(vote.mediaItemId, vote.value);
    for (const [id, value] of localVotes) if (!map.has(id)) map.set(id, value);
    return map;
  }, [progress, localVotes]);

  if (deck === undefined || progress === undefined) {
    return <Centered>Loading the deck…</Centered>;
  }
  if (deck === null || progress === null) {
    return <Centered>Couldn&apos;t load this session.</Centered>;
  }

  const remaining = deck.filter((item) => !merged.has(item.mediaItemId));
  const current = remaining[0];
  const next = remaining[1];
  const superUsed = deck.reduce(
    (acc, item) => acc + (merged.get(item.mediaItemId) === 2 ? 1 : 0),
    0
  );
  const superLeft = Math.max(0, session.superLikesAllowed - superUsed);
  const doneCount = deck.length - remaining.length;

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const commitVote = (item: DeckItem, value: VoteValue) => {
    setLocalVotes((prev) => new Map(prev).set(item.mediaItemId, value));
    castVote({
      code,
      participantSecret,
      mediaItemId: item.mediaItemId as Id<"mediaItems">,
      value,
    }).catch((err) => {
      if (errorCode(err) === "SUPERLIKE_BUDGET") {
        showToast("That super like didn't count — none left");
      }
      // myProgress is reactive; the server's truth wins on refresh.
    });
  };

  const buttonVote = (value: VoteValue) => {
    if (!current) return;
    if (value === 2 && superLeft <= 0) {
      showToast("No super likes left");
      return;
    }
    // Same exit path as a physical swipe.
    cardRef.current?.swipe(value);
  };

  if (!current) {
    // All cards voted locally; parent flips to WaitingForOthers via progress.
    return <Centered>Nice — you&apos;re done! Waiting for the others…</Centered>;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          {doneCount + 1} of {deck.length}
        </span>
        <span className="rounded-full bg-sky-400/10 px-3 py-1 font-semibold text-sky-400">
          ★ {superLeft} left
        </span>
      </header>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemax={deck.length}
      >
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${(doneCount / deck.length) * 100}%` }}
        />
      </div>

      <div className="relative flex-1" style={{ minHeight: "60vh" }}>
        {next && (
          <div className="absolute inset-0 scale-95 overflow-hidden rounded-2xl opacity-60">
            <PosterImage
              posterPath={next.posterPath}
              title={next.title}
              size="w500"
              className="h-full w-full"
            />
          </div>
        )}
        <SwipeCard
          key={current.mediaItemId}
          ref={cardRef}
          item={current}
          superLeft={superLeft}
          onVote={(value) => commitVote(current, value)}
          onSuperRejected={() => showToast("No super likes left")}
          onOpenDetail={() => setDetailItem(current)}
        />
      </div>

      <VoteButtons onVote={buttonVote} superLeft={superLeft} />
      <p className="text-center text-xs text-zinc-600">
        Tap the card for details · swipe up to super like
      </p>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 top-6 z-50 mx-auto w-fit rounded-full bg-zinc-800 px-4 py-2 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <DetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center text-zinc-400">
      {children}
    </main>
  );
}
