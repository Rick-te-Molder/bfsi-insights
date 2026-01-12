import { useEffect, useState } from 'react';

export function usePublishedDateState(publishedAt: unknown) {
  const [publishedDate, setPublishedDate] = useState('');

  useEffect(() => {
    if (!publishedAt) {
      setPublishedDate('');
      return;
    }

    const dateStr = String(publishedAt);

    // Handle YYYY-MM format (month+year only) - keep as-is
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      setPublishedDate(dateStr);
      return;
    }

    // Handle full date format
    try {
      const formatted = new Date(dateStr).toISOString().split('T')[0];
      setPublishedDate(formatted);
    } catch (e) {
      console.error('Error formatting date:', e);
      setPublishedDate('');
    }
  }, [publishedAt]);

  return { publishedDate, setPublishedDate };
}
