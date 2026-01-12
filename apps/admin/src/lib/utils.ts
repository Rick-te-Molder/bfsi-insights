import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string for display.
 * Supports YYYY-MM-DD (full date) and YYYY-MM (month+year only).
 */
export function formatDate(dateString: string): string {
  // Check if it's month-year only format (YYYY-MM)
  if (/^\d{4}-\d{2}$/.test(dateString)) {
    const [year, month] = dateString.split('-');
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  // Full date format
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string with time for display.
 * Supports YYYY-MM-DD (full date) and YYYY-MM (month+year only).
 */
export function formatDateTime(dateString: string): string {
  // Check if it's month-year only format (YYYY-MM)
  if (/^\d{4}-\d{2}$/.test(dateString)) {
    const [year, month] = dateString.split('-');
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  // Full date format with time
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// KB-285: Fallback status colors for server-side code where StatusContext unavailable
// PREFER: Use useStatus().getStatusColor() from StatusContext where possible
// Colors are now stored in status_lookup.color column (single source of truth)
const STATUS_CODE_TO_COLOR: Record<number, string> = {
  // Discovery (100s) - neutral/amber for processing
  100: 'bg-neutral-500/20 text-neutral-300',
  110: 'bg-neutral-500/20 text-neutral-300',
  111: 'bg-amber-500/20 text-amber-300',
  112: 'bg-neutral-500/20 text-neutral-300',
  120: 'bg-neutral-500/20 text-neutral-300',
  121: 'bg-amber-500/20 text-amber-300',
  122: 'bg-neutral-500/20 text-neutral-300',
  // Enrichment (200s) - sky for ready, amber for processing
  200: 'bg-sky-500/20 text-sky-300',
  210: 'bg-sky-500/20 text-sky-300',
  211: 'bg-amber-500/20 text-amber-300',
  212: 'bg-sky-500/20 text-sky-300',
  220: 'bg-sky-500/20 text-sky-300',
  221: 'bg-amber-500/20 text-amber-300',
  222: 'bg-sky-500/20 text-sky-300',
  230: 'bg-sky-500/20 text-sky-300',
  231: 'bg-amber-500/20 text-amber-300',
  232: 'bg-sky-500/20 text-sky-300',
  240: 'bg-emerald-500/20 text-emerald-300',
  // Review (300s) - purple for pending, amber for active, green for done
  300: 'bg-purple-500/20 text-purple-300',
  310: 'bg-amber-500/20 text-amber-300',
  320: 'bg-amber-500/20 text-amber-300',
  330: 'bg-green-500/20 text-green-300',
  // Published (400s) - green
  400: 'bg-green-500/20 text-green-300',
  410: 'bg-green-500/20 text-green-300',
  // Terminal (500s) - red for errors, neutral for filtered
  500: 'bg-red-500/20 text-red-300',
  510: 'bg-red-500/20 text-red-300',
  520: 'bg-neutral-500/20 text-neutral-400',
  530: 'bg-neutral-500/20 text-neutral-400',
  540: 'bg-red-500/20 text-red-300',
  550: 'bg-neutral-500/20 text-neutral-400',
  560: 'bg-red-500/20 text-red-300',
};

// Legacy function for string-based status (keep for backwards compatibility)
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    enriched: 'bg-emerald-500/20 text-emerald-300',
    approved: 'bg-green-500/20 text-green-300',
    rejected: 'bg-red-500/20 text-red-300',
    failed: 'bg-red-500/20 text-red-300',
    pending_review: 'bg-purple-500/20 text-purple-300',
  };
  return colors[status] || 'bg-neutral-500/20 text-neutral-300';
}

// KB-277: Convert status_code to status string for display
// KB-285: Use actual status names from status_lookup table
const STATUS_CODE_TO_NAME: Record<number, string> = {
  // Discovery (100s)
  100: 'discovered',
  110: 'to_fetch',
  111: 'fetching',
  112: 'fetched',
  120: 'to_score',
  121: 'scoring',
  122: 'scored',
  // Enrichment (200s)
  200: 'pending_enrichment',
  210: 'to_summarize',
  211: 'summarizing',
  212: 'summarized',
  220: 'to_tag',
  221: 'tagging',
  222: 'tagged',
  230: 'to_thumbnail',
  231: 'thumbnailing',
  232: 'thumbnailed',
  240: 'enriched',
  // Review (300s)
  300: 'pending_review',
  310: 'in_review',
  320: 'editing',
  330: 'approved',
  // Published (400s)
  400: 'published',
  410: 'updated',
  // Terminal (500s)
  500: 'failed',
  510: 'unreachable',
  520: 'duplicate',
  530: 'irrelevant',
  540: 'rejected',
  550: 'unpublished',
  560: 'dead_letter',
};

export function getStatusName(statusCode: number): string {
  return STATUS_CODE_TO_NAME[statusCode] || 'pending';
}

export function getStatusColorByCode(statusCode: number): string {
  return STATUS_CODE_TO_COLOR[statusCode] || 'bg-neutral-500/20 text-neutral-300';
}
