"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { setSessionKeys, useStoredAuth } from "@/lib/storage";
import { errorCode, errorMessage } from "@/lib/errors";

type Server = {
  name: string;
  clientIdentifier: string;
  owned: boolean;
  relayOnly: boolean;
};
type Library = { key: string; title: string; type: "movie" | "show" };
type Tag = { key: string; title: string };

type Filters = {
  genres?: string[];
  genreLabels?: string[];
  unwatchedOnly?: boolean;
  contentRatings?: string[];
  yearMin?: number;
  yearMax?: number;
  runtimeMinMin?: number;
  runtimeMaxMin?: number;
};

const COUNT_OPTIONS = [10, 15, 20, 25, 50, 100];

export default function CreateWizard() {
  const router = useRouter();
  const listServers = useAction(api.plex.listServers);
  const listLibraries = useAction(api.plex.listLibraries);
  const previewFilters = useAction(api.plex.previewFilters);
  const createSession = useAction(api.sessions.create);

  const { loaded, auth } = useStoredAuth();
  const credentialArgs = useMemo(
    () =>
      auth
        ? {
            credentialId: auth.credentialId as Id<"plexCredentials">,
            authSecret: auth.authSecret,
          }
        : null,
    [auth]
  );

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [hostName, setHostName] = useState("");
  const [servers, setServers] = useState<Server[] | null>(null);
  const [server, setServer] = useState<Server | null>(null);
  const [libraries, setLibraries] = useState<Library[] | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [count, setCount] = useState(20);
  const [customCount, setCustomCount] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [genres, setGenres] = useState<Tag[]>([]);
  const [contentRatings, setContentRatings] = useState<Tag[]>([]);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [relayWarning, setRelayWarning] = useState(false);

  // Redirect if not signed in.
  useEffect(() => {
    if (loaded && !auth) router.replace("/");
  }, [loaded, auth, router]);

  const fail = useCallback(
    (err: unknown) => {
      const code = errorCode(err);
      if (code === "UNAUTHORIZED" || code === "WAITLISTED") {
        router.replace("/");
        return;
      }
      setError(errorMessage(err));
    },
    [router]
  );

  // Load servers on mount.
  useEffect(() => {
    if (!credentialArgs) return;
    listServers(credentialArgs).then(setServers).catch(fail);
  }, [credentialArgs, listServers, fail]);

  // Load libraries when a server is picked (setLibraries(null) happens in the
  // server-select click handler, so this effect only fetches).
  useEffect(() => {
    if (!credentialArgs || !server) return;
    let cancelled = false;
    listLibraries({ ...credentialArgs, serverClientId: server.clientIdentifier })
      .then((libs) => {
        if (!cancelled) setLibraries(libs);
      })
      .catch((err) => {
        if (!cancelled) fail(err);
      });
    return () => {
      cancelled = true;
    };
  }, [credentialArgs, server, listLibraries, fail]);

  // Live filter preview (debounced) once on the filters step.
  const previewSeq = useRef(0);
  useEffect(() => {
    if (!credentialArgs || !server || !library || step !== 3) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(() => {
      setMatchCount(null);
      previewFilters({
        ...credentialArgs,
        serverClientId: server.clientIdentifier,
        libraryKey: library.key,
        mediaType: library.type,
        filters,
      })
        .then((res) => {
          if (previewSeq.current !== seq) return;
          setGenres(res.genres);
          setContentRatings(res.contentRatings);
          setMatchCount(res.matchCount);
          setRelayWarning(res.relay);
        })
        .catch((err) => {
          if (previewSeq.current === seq) fail(err);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [credentialArgs, server, library, filters, step, previewFilters, fail]);

  const effectiveCount = customCount ? parseInt(customCount, 10) || 0 : count;

  const submit = async () => {
    if (!credentialArgs || !server || !library) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createSession({
        ...credentialArgs,
        serverClientId: server.clientIdentifier,
        libraryKey: library.key,
        mediaType: library.type,
        count: effectiveCount,
        filters,
        hostName: hostName.trim() || "Host",
      });
      setSessionKeys(result.code, {
        participantSecret: result.participantSecret,
        hostKey: result.hostKey,
      });
      router.push(`/s/${result.code}`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const toggle = (list: string[] | undefined, value: string) => {
    const set = new Set(list ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return set.size > 0 ? [...set] : undefined;
  };

  if (!loaded || !auth) return null;

  const steps = ["You", "Library", "Deck size", "Filters"];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Host a movie night</h1>
        <ol className="flex gap-2 text-xs">
          {steps.map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 ${
                i === step
                  ? "bg-amber-500 font-semibold text-zinc-950"
                  : i < step
                    ? "bg-zinc-800 text-zinc-300"
                    : "bg-zinc-900 text-zinc-600"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-900 bg-rose-950/50 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {step === 0 && (
        <section className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">Your display name</span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              maxLength={24}
              placeholder="e.g. Daly"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-500"
            />
          </label>
          <div className="space-y-2">
            <span className="text-sm text-zinc-400">Plex server</span>
            {servers === null ? (
              <p className="text-sm text-zinc-500">Loading your servers…</p>
            ) : servers.length === 0 ? (
              <p className="text-sm text-rose-400">
                No Plex servers are visible to your account.
              </p>
            ) : (
              <div className="grid gap-2">
                {servers.map((s) => (
                  <button
                    key={s.clientIdentifier}
                    onClick={() => {
                      setServer(s);
                      setLibrary(null);
                      setLibraries(null);
                    }}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      server?.clientIdentifier === s.clientIdentifier
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                    }`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {s.owned ? "owned" : "shared"}
                      {s.relayOnly ? " · relay only (slow)" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            disabled={!server || hostName.trim().length === 0}
            onClick={() => setStep(1)}
            className="w-full rounded-full bg-amber-500 py-3 font-semibold text-zinc-950 disabled:opacity-40"
          >
            Next
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <span className="text-sm text-zinc-400">
            Which library are we picking from?
          </span>
          {libraries === null ? (
            <p className="text-sm text-zinc-500">Loading libraries…</p>
          ) : (
            <div className="grid gap-2">
              {libraries.map((lib) => (
                <button
                  key={lib.key}
                  onClick={() => setLibrary(lib)}
                  className={`rounded-lg border px-4 py-3 text-left ${
                    library?.key === lib.key
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                  }`}
                >
                  <span className="font-medium">{lib.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {lib.type === "movie" ? "Movies" : "TV Shows"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <WizardNav
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            nextDisabled={!library}
          />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <span className="text-sm text-zinc-400">
            How many {library?.type === "show" ? "shows" : "movies"} in the
            deck? Everyone swipes through all of them.
          </span>
          <div className="grid grid-cols-3 gap-2">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setCount(n);
                  setCustomCount("");
                }}
                className={`rounded-lg border py-3 font-semibold ${
                  !customCount && count === n
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">Or a custom number (2–200)</span>
            <input
              inputMode="numeric"
              value={customCount}
              onChange={(e) => setCustomCount(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 30"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-500"
            />
          </label>
          <WizardNav
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={effectiveCount < 2 || effectiveCount > 200}
          />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm">
            {matchCount === null ? (
              <span className="text-zinc-500">Counting matches…</span>
            ) : (
              <span>
                <strong className="text-amber-400">{matchCount}</strong>{" "}
                {library?.type === "show" ? "shows" : "movies"} match
                {matchCount < effectiveCount && (
                  <span className="text-zinc-400">
                    {" "}
                    — the deck will be {Math.max(matchCount, 0)} instead of{" "}
                    {effectiveCount}
                  </span>
                )}
              </span>
            )}
            {relayWarning && (
              <p className="mt-1 text-xs text-amber-600">
                Connected via Plex relay — creation may be slow.
              </p>
            )}
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={filters.unwatchedOnly ?? false}
              onChange={(e) =>
                setFilters({ ...filters, unwatchedOnly: e.target.checked || undefined })
              }
              className="h-5 w-5 accent-amber-500"
            />
            <span>Unwatched only</span>
          </label>

          {genres.length > 0 && (
            <TagPicker
              label="Genres (any of)"
              tags={genres}
              selected={filters.genres}
              onToggle={(key) => {
                const next = toggle(filters.genres, key);
                const labels = next?.map(
                  (k) => genres.find((g) => g.key === k)?.title ?? k
                );
                setFilters({ ...filters, genres: next, genreLabels: labels });
              }}
            />
          )}

          {contentRatings.length > 0 && (
            <TagPicker
              label="Content ratings"
              tags={contentRatings}
              selected={filters.contentRatings}
              onToggle={(key) =>
                setFilters({
                  ...filters,
                  contentRatings: toggle(filters.contentRatings, key),
                })
              }
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Year from"
              value={filters.yearMin}
              onChange={(v) => setFilters({ ...filters, yearMin: v })}
              placeholder="1980"
            />
            <NumberField
              label="Year to"
              value={filters.yearMax}
              onChange={(v) => setFilters({ ...filters, yearMax: v })}
              placeholder="2026"
            />
            <NumberField
              label="Min runtime (min)"
              value={filters.runtimeMinMin}
              onChange={(v) => setFilters({ ...filters, runtimeMinMin: v })}
              placeholder="60"
            />
            <NumberField
              label="Max runtime (min)"
              value={filters.runtimeMaxMin}
              onChange={(v) => setFilters({ ...filters, runtimeMaxMin: v })}
              placeholder="150"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-full border border-zinc-700 py-3 font-semibold text-zinc-300"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={busy || matchCount === 0}
              className="flex-1 rounded-full bg-amber-500 py-3 font-semibold text-zinc-950 disabled:opacity-40"
            >
              {busy ? "Building deck…" : "Create session"}
            </button>
          </div>
          {busy && (
            <p className="text-center text-sm text-zinc-500">
              Shuffling your library and grabbing artwork — a few seconds…
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="flex-1 rounded-full border border-zinc-700 py-3 font-semibold text-zinc-300"
      >
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 rounded-full bg-amber-500 py-3 font-semibold text-zinc-950 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function TagPicker({
  label,
  tags,
  selected,
  onToggle,
}: {
  label: string;
  tags: Tag[];
  selected: string[] | undefined;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selected?.includes(tag.key) ?? false;
          return (
            <button
              key={tag.key}
              onClick={() => onToggle(tag.key)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                active
                  ? "border-amber-500 bg-amber-500/15 text-amber-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {tag.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? parseInt(digits, 10) : undefined);
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
      />
    </label>
  );
}
