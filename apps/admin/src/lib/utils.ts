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

// Status colors and names are now stored in status_lookup table (single source of truth)
// Use useStatus() from StatusContext to get status name and color in client components
