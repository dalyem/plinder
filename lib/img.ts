// TMDB image CDN URL builder — images are hotlinked so neither Plex nor the
// app's backend ever serves a byte of poster traffic.

export type PosterSize = "w185" | "w342" | "w500" | "w780";

export function tmdbImage(path: string | undefined, size: PosterSize): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbBackdrop(path: string | undefined): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w780${path}`;
}
