/**
 * Normalize authors from various formats to string array
 * DB may store as "John Doe, Jane Smith" or ["John", "Jane"]
 */
export function normalizeAuthors(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Non-string, non-array objects cannot be meaningfully converted
  return [];
}
