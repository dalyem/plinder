import Link from "next/link";

export function GonePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl" aria-hidden>
        🎞️
      </p>
      <h1 className="text-2xl font-bold">This session has ended</h1>
      <p className="max-w-sm text-zinc-400">
        Either the link is wrong, or this movie night wrapped up and its
        results have expired. Ask your host for a fresh link!
      </p>
      <Link
        href="/"
        className="rounded-full bg-amber-500 px-6 py-3 font-semibold text-zinc-950"
      >
        Host your own
      </Link>
    </main>
  );
}
