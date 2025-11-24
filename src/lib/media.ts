// Thumbnail and preview helpers for publications

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

/**
 * Expand a thumbnail hint into concrete image URLs.
 *
 * - If it's already a full image path/URL (with extension), return it as-is.
 * - If it's an http(s) URL without extension, return it as-is.
 * - Otherwise, treat it as a base slug and generate common extensions.
 */
export function expandItemThumb(t?: string): string[] {
  if (!t) return [];

  // Direct image file (local or remote)
  if (/\.(webp|png|jpe?g)$/i.test(t)) {
    return [t];
  }

  // Remote URL without obvious extension – do not append suffixes
  if (isHttpUrl(t)) {
    return [t];
  }

  // Treat as local base name / slug
  return [`${t}.webp`, `${t}.png`, `${t}.jpg`];
}

/**
 * Guess local thumbnail paths for a given slug.
 *
 * Server-side code can do actual filesystem lookups; on the client we keep it
 * simple and generate likely static paths under /thumbs.
 */
export function findLocalThumbs(slug?: string): string[] {
  if (!slug) return [];
  return [`/thumbs/${slug}.webp`, `/thumbs/${slug}.png`, `/thumbs/${slug}.jpg`];
}

/**
 * Build a candidate list of image URLs, preferring local thumbs but also
 * including any thumbnail hint from the publication.
 *
 * Order:
 *   1) Local guesses for the slug
 *   2) Variants from the thumbnail field
 *
 * Duplicates are removed while preserving order.
 */
export function buildImageCandidates(opts: { slug?: string; thumbnail?: string }): string[] {
  const { slug, thumbnail } = opts;
  const local = findLocalThumbs(slug);
  const item = expandItemThumb(thumbnail);
  const list = [...local, ...item];

  // De-duplicate while preserving order
  return Array.from(new Set(list));
}
