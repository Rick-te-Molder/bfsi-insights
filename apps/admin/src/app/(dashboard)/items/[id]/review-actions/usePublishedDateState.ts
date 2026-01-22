import { useEffect, useState } from 'react';

function toTrimmedStringOrEmpty(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function computePublishedDate(publishedAt: unknown): string {
  if (!publishedAt) return '';

  const dateStr = toTrimmedStringOrEmpty(publishedAt);
  if (!dateStr) return '';

  // Handle YYYY-MM format (month+year only) - keep as-is
  if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;

  try {
    return new Date(dateStr).toISOString().split('T')[0] ?? '';
  } catch {
    return '';
  }
}

export function usePublishedDateState(publishedAt: unknown) {
  const [publishedDate, setPublishedDate] = useState('');

  useEffect(() => {
    setPublishedDate(computePublishedDate(publishedAt));
  }, [publishedAt]);

  return { publishedDate, setPublishedDate };
}
