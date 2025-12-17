import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
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

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-neutral-500/20 text-neutral-300',
    queued: 'bg-sky-500/20 text-sky-300',
    processing: 'bg-amber-500/20 text-amber-300',
    enriched: 'bg-emerald-500/20 text-emerald-300',
    approved: 'bg-green-500/20 text-green-300',
    rejected: 'bg-red-500/20 text-red-300',
    failed: 'bg-red-500/20 text-red-300',
    irrelevant: 'bg-neutral-500/20 text-neutral-400',
    pending_review: 'bg-sky-500/20 text-sky-300',
  };
  return colors[status] || 'bg-neutral-500/20 text-neutral-300';
}

// KB-277: Convert status_code to status string for display
const STATUS_CODE_TO_NAME: Record<number, string> = {
  200: 'pending',
  210: 'queued',
  211: 'processing',
  220: 'queued',
  221: 'processing',
  230: 'queued',
  231: 'processing',
  240: 'enriched',
  300: 'pending_review',
  330: 'approved',
  400: 'approved',
  500: 'failed',
  530: 'irrelevant',
  540: 'rejected',
  599: 'failed',
};

export function getStatusName(statusCode: number): string {
  return STATUS_CODE_TO_NAME[statusCode] || 'pending';
}

export function getStatusColorByCode(statusCode: number): string {
  return getStatusColor(getStatusName(statusCode));
}
