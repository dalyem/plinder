"use client";

import { AnimatePresence, motion } from "motion/react";
import type { DeckItem } from "@/lib/types";
import { PosterImage } from "@/components/media/PosterImage";
import { tmdbBackdrop } from "@/lib/img";

export function DetailSheet({
  item,
  onClose,
}: {
  item: DeckItem | null;
  onClose: () => void;
}) {
  const backdrop = tmdbBackdrop(item?.backdropPath);
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${item.title}`}
          >
            {backdrop && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={backdrop}
                alt=""
                className="h-44 w-full object-cover opacity-60"
              />
            )}
            <div className="space-y-4 p-5">
              <div className="flex gap-4">
                <PosterImage
                  posterPath={item.posterPath}
                  title={item.title}
                  size="w185"
                  className={`w-24 shrink-0 rounded-lg ${backdrop ? "-mt-16 shadow-xl" : ""}`}
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{item.title}</h2>
                  <p className="text-sm text-zinc-400">
                    {[
                      item.year,
                      item.runtimeMin ? `${item.runtimeMin} min` : null,
                      item.contentRating,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {item.tmdbRating !== undefined && (
                    <p className="mt-1 text-sm text-amber-400">
                      ★ {item.tmdbRating.toFixed(1)} / 10 on TMDB
                    </p>
                  )}
                </div>
              </div>

              {item.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {item.summary && (
                <p className="text-sm leading-relaxed text-zinc-300">
                  {item.summary}
                </p>
              )}

              {item.directors.length > 0 && (
                <p className="text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-200">
                    {item.directors.length > 1 ? "Directors" : "Director"}:
                  </span>{" "}
                  {item.directors.join(", ")}
                </p>
              )}
              {item.cast.length > 0 && (
                <p className="text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-200">Cast:</span>{" "}
                  {item.cast.join(", ")}
                </p>
              )}

              {item.trailerKey && (
                <a
                  href={`https://www.youtube.com/watch?v=${item.trailerKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-400"
                >
                  ▶ Watch trailer
                </a>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-full bg-zinc-800 py-3 font-semibold text-zinc-200"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
