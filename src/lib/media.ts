// Thumbnail and preview helpers for resources

export function expandItemThumb(t?: string): string[] {
  if (!t) return [];
  return /\.(webp|png|jpe?g)$/i.test(t) ? [t] : [`${t}.webp`, `${t}.png`, `${t}.jpg`];
}

export function findLocalThumbs(slug?: string): string[] {
  if (!slug) return [];
  // Guess common variants; server-side pages can still pre-resolve, but client stays fs-free
  return [`/thumbs/${slug}.png`, `/thumbs/${slug}.webp`, `/thumbs/${slug}.jpg`];
}

// Utility to build candidate list with a local-first preference
export function buildImageCandidates(opts: { slug?: string; thumbnail?: string }): string[] {
  const { slug, thumbnail } = opts;
  const local = findLocalThumbs(slug);
  const item = expandItemThumb(thumbnail);
  const list = [...local, ...item];
  // De-dup while preserving order
  return Array.from(new Set(list));
}
