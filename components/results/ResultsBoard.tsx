"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ResultItem } from "@/lib/types";
import { PosterImage } from "@/components/media/PosterImage";
import { errorMessage } from "@/lib/errors";

export function ResultsBoard({
  code,
  hostKey,
  big = false,
}: {
  code: string;
  hostKey?: string;
  big?: boolean;
}) {
  const results = useQuery(api.results.get, { code });

  if (results === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-400">
        Tallying the votes…
      </main>
    );
  }
  if (results === null) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-400">
        Results aren&apos;t ready yet.
      </main>
    );
  }

  return <Board code={code} hostKey={hostKey} big={big} results={results} />;
}

function Board({
  code,
  hostKey,
  big,
  results,
}: {
  code: string;
  hostKey?: string;
  big: boolean;
  results: NonNullable<ReturnType<typeof useQuery<typeof api.results.get>>>;
}) {
  const byId = useMemo(
    () => new Map(results.items.map((item) => [String(item.mediaItemId), item])),
    [results.items]
  );
  const isTie = results.topPickIds.length > 1 && !results.tieWinnerItemId;
  const winnerId = results.tieWinnerItemId ?? (results.topPickIds.length === 1 ? results.topPickIds[0] : null);
  const winner = winnerId ? byId.get(String(winnerId)) : null;
  const unanimousYes = results.unanimousYesIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean) as ResultItem[];
  const unanimousNo = results.unanimousNoIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean) as ResultItem[];

  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-8 px-6 py-10 ${big ? "max-w-4xl" : "max-w-md"}`}
    >
      {winner ? (
        <TopPickHero item={winner} big={big} />
      ) : isTie ? (
        <TieBanner
          code={code}
          hostKey={hostKey}
          tied={results.topPickIds
            .map((id) => byId.get(String(id)))
            .filter(Boolean) as ResultItem[]}
          big={big}
        />
      ) : (
        <p className="text-center text-zinc-400">
          No clear favorite this round — check the rankings below.
        </p>
      )}

      {unanimousYes.length > 0 && (
        <UnanimousSection
          title="Everyone said yes 🎉"
          items={unanimousYes}
          tone="emerald"
        />
      )}
      {unanimousNo.length > 0 && (
        <UnanimousSection
          title="Everyone said no 🪦"
          items={unanimousNo}
          tone="rose"
        />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Full rankings
        </h2>
        <ol className="space-y-3">
          {results.items.map((item, i) => (
            <ResultRow key={String(item.mediaItemId)} item={item} rank={i + 1} />
          ))}
        </ol>
      </section>

      {results.expiresAt && (
        <p className="text-center text-xs text-zinc-600">
          These results self-destruct{" "}
          {new Date(results.expiresAt).toLocaleString()}.
        </p>
      )}
    </main>
  );
}

function TopPickHero({ item, big }: { item: ResultItem; big: boolean }) {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
        Tonight&apos;s pick
      </p>
      <PosterImage
        posterPath={item.posterPath}
        title={item.title}
        size={big ? "w780" : "w500"}
        className={`rounded-2xl shadow-2xl ${big ? "w-72" : "w-56"}`}
      />
      <div>
        <h1 className={`font-bold ${big ? "text-4xl" : "text-3xl"}`}>{item.title}</h1>
        <p className="text-zinc-400">
          {[item.year, item.runtimeMin ? `${item.runtimeMin} min` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 font-semibold text-amber-400">{item.score} points</p>
      </div>
    </section>
  );
}

function TieBanner({
  code,
  hostKey,
  tied,
  big,
}: {
  code: string;
  hostKey?: string;
  tied: ResultItem[];
  big: boolean;
}) {
  const pickRandom = useMutation(api.sessions.pickRandomWinner);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
        It&apos;s a tie!
      </p>
      <div className="flex flex-wrap items-start justify-center gap-4">
        {tied.map((item) => (
          <div key={String(item.mediaItemId)} className="w-32 space-y-1">
            <PosterImage
              posterPath={item.posterPath}
              title={item.title}
              size="w342"
              className="rounded-xl"
            />
            <p className={`font-semibold ${big ? "text-base" : "text-sm"}`}>
              {item.title}
            </p>
          </div>
        ))}
      </div>
      {hostKey ? (
        <button
          onClick={() =>
            pickRandom({ code, hostKey }).catch((e) => setError(errorMessage(e)))
          }
          className="rounded-full bg-amber-500 px-6 py-3 font-semibold text-zinc-950"
        >
          🎲 Pick a random winner
        </button>
      ) : (
        <p className="text-sm text-zinc-500">
          The host can roll the dice to break the tie.
        </p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </section>
  );
}

function UnanimousSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: ResultItem[];
  tone: "emerald" | "rose";
}) {
  return (
    <section className="space-y-2">
      <h2
        className={`text-sm font-semibold ${tone === "emerald" ? "text-emerald-400" : "text-rose-400"}`}
      >
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <div key={String(item.mediaItemId)} className="w-20 shrink-0 space-y-1">
            <PosterImage
              posterPath={item.posterPath}
              title={item.title}
              size="w185"
              className="rounded-lg"
            />
            <p className="truncate text-xs text-zinc-400">{item.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultRow({ item, rank }: { item: ResultItem; rank: number }) {
  return (
    <li className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <span className="w-6 shrink-0 text-center font-bold text-zinc-500">
        {rank}
      </span>
      <PosterImage
        posterPath={item.posterPath}
        title={item.title}
        size="w185"
        className="h-20 w-14 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold">{item.title}</p>
          <span className="shrink-0 text-sm font-bold text-amber-400">
            {item.score} pts
          </span>
        </div>
        {item.yesNames.length > 0 && (
          <p className="mt-1 text-xs text-zinc-400">
            <span className="text-emerald-400">♥</span>{" "}
            {item.yesNames.join(", ")}
          </p>
        )}
        {item.superNames.length > 0 && (
          <p className="text-xs text-zinc-400">
            <span className="text-sky-400">★</span> {item.superNames.join(", ")}
          </p>
        )}
        {item.yesNames.length === 0 && (
          <p className="mt-1 text-xs text-zinc-600">No takers</p>
        )}
      </div>
    </li>
  );
}
