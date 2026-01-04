import { TagPayload } from './types';

interface TaggedCode {
  code: string;
  confidence?: number;
}

// Color map for Tailwind classes
export const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-300' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-300' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-300' },
  red: { bg: 'bg-red-500/10', text: 'text-red-300' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-300' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-300' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-300' },
  neutral: { bg: 'bg-neutral-500/10', text: 'text-neutral-300' },
};

/**
 * Extract values from a payload field path (e.g., "industry_codes" or "audience_scores.executive")
 */
export function getPayloadValue(payload: TagPayload, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let value: unknown = payload;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Extract codes from tagged items (handles both string[] and {code, confidence}[])
 */
export function extractCodes(items: unknown): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((item) =>
      typeof item === 'object' && item !== null ? (item as TaggedCode).code : (item as string),
    )
    .filter((c): c is string => typeof c === 'string' && c !== 'null' && c !== '');
}

/**
 * Extract string array (for expandable types like vendor_names)
 */
export function extractStrings(items: unknown): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((s): s is string => typeof s === 'string' && s !== 'null' && s !== '');
}
