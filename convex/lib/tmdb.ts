import { tmdbFetch } from "./plexApi";

export type TmdbEnrichment = {
  summary?: string;
  genres: string[];
  runtimeMin?: number;
  tmdbRating?: number;
  cast: string[];
  directors: string[];
  posterPath?: string;
  backdropPath?: string;
  trailerKey?: string;
};

type TmdbDetails = {
  overview?: string;
  genres?: Array<{ name: string }>;
  runtime?: number; // movie
  episode_run_time?: number[]; // tv
  vote_average?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  created_by?: Array<{ name: string }>; // tv
  credits?: {
    cast?: Array<{ name: string }>;
    crew?: Array<{ name: string; job: string }>;
  };
  videos?: { results?: Array<{ site: string; type: string; key: string }> };
};

export async function fetchTmdbDetails(
  mediaType: "movie" | "show",
  tmdbId: number
): Promise<TmdbEnrichment | null> {
  const kind = mediaType === "movie" ? "movie" : "tv";
  const data = (await tmdbFetch(
    `/${kind}/${tmdbId}?append_to_response=credits,videos`
  )) as TmdbDetails | null;
  if (!data) return null;

  const directors =
    mediaType === "movie"
      ? (data.credits?.crew ?? [])
          .filter((c) => c.job === "Director")
          .map((c) => c.name)
      : (data.created_by ?? []).map((c) => c.name);

  const videos = data.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube" && v.type === "Teaser");

  return {
    summary: data.overview || undefined,
    genres: (data.genres ?? []).map((g) => g.name),
    runtimeMin: data.runtime ?? data.episode_run_time?.[0] ?? undefined,
    tmdbRating: data.vote_average ?? undefined,
    cast: (data.credits?.cast ?? []).slice(0, 8).map((c) => c.name),
    directors: directors.slice(0, 4),
    posterPath: data.poster_path ?? undefined,
    backdropPath: data.backdrop_path ?? undefined,
    trailerKey: trailer?.key,
  };
}

/** Run enrichment with bounded concurrency so a 100-item deck stays polite. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
