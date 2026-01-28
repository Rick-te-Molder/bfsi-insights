/**
 * Shared time formatting utilities
 * Eliminates duplication across sidebar components
 */

/**
 * Format a date as a human-readable "time ago" string
 * @param date - ISO date string or null
 * @returns Formatted string like "5m ago", "2h ago", "3d ago"
 */
export function formatTimeAgo(date: string | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
