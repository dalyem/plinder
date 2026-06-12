"use client";

import { useState } from "react";
import { tmdbImage, type PosterSize } from "@/lib/img";

/**
 * Poster hotlinked from TMDB's CDN. Plain <img> on purpose: next/image would
 * route every poster through Vercel's optimizer, paying bandwidth for what
 * TMDB already serves resized from a CDN.
 */
export function PosterImage({
  posterPath,
  title,
  size = "w500",
  className = "",
}: {
  posterPath?: string;
  title: string;
  size?: PosterSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = tmdbImage(posterPath, size);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`Poster for ${title}`}
        className={`flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 text-center ${className}`}
      >
        <span className="text-xl font-bold text-zinc-400">{title}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Poster for ${title}`}
      draggable={false}
      onError={() => setFailed(true)}
      className={`select-none object-cover ${className}`}
    />
  );
}
