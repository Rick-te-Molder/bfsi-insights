// Thumbnail and preview helpers for resources

export function externalThumb(u?: string, width = 960): string | null {
  if (!u) return null;
  const enc = encodeURIComponent(u);
  return `https://image.thum.io/get/nojs/width/${width}/crop/${width}/${enc}`;
}

export function expandItemThumb(t?: string): string[] {
  if (!t) return [];
  return /\.(webp|png|jpe?g)$/i.test(t) ? [t] : [`${t}.webp`, `${t}.png`, `${t}.jpg`];
}

export function findLocalThumbs(slug?: string): string[] {
  if (!slug) return [];
  // Guess common variants; server-side pages can still pre-resolve, but client stays fs-free
  return [`/thumbs/${slug}.png`, `/thumbs/${slug}.webp`, `/thumbs/${slug}.jpg`];
}

// Utility to build candidate list with a local-first preference and graceful fallback
export function buildImageCandidates(opts: {
  slug?: string;
  thumbnail?: string;
  url?: string;
  preferWidth?: number;
}): string[] {
  const { slug, thumbnail, url, preferWidth = 960 } = opts;
  const item = expandItemThumb(thumbnail);
  const local = findLocalThumbs(slug);
  const ext = externalThumb(url, preferWidth);
  const list = [...item, ...local];
  if (ext) list.push(ext);
  // De-dup while preserving order
  return Array.from(new Set(list));
}
