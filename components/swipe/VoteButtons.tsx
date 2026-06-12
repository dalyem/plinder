"use client";

import type { VoteValue } from "@/lib/types";

/** Accessible voting buttons — first-class, not a fallback for swiping. */
export function VoteButtons({
  onVote,
  superLeft,
  disabled,
}: {
  onVote: (value: VoteValue) => void;
  superLeft: number;
  disabled?: boolean;
}) {
  const base =
    "flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl transition active:scale-90 disabled:opacity-30";
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        aria-label="No — swipe left"
        disabled={disabled}
        onClick={() => onVote(0)}
        className={`${base} border-rose-500 text-rose-500 hover:bg-rose-500/10`}
      >
        ✕
      </button>
      <button
        aria-label={`Super like — ${superLeft} left`}
        disabled={disabled || superLeft <= 0}
        onClick={() => onVote(2)}
        className={`${base} border-sky-400 text-sky-400 hover:bg-sky-400/10`}
      >
        ★
      </button>
      <button
        aria-label="Yes — swipe right"
        disabled={disabled}
        onClick={() => onVote(1)}
        className={`${base} border-emerald-400 text-emerald-400 hover:bg-emerald-400/10`}
      >
        ♥
      </button>
    </div>
  );
}
