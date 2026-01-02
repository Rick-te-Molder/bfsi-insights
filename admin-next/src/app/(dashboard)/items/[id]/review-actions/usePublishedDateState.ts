import { useEffect, useState } from 'react';

export function usePublishedDateState(publishedAt: unknown) {
  const [publishedDate, setPublishedDate] = useState('');

  useEffect(() => {
    if (!publishedAt) {
      setPublishedDate('');
      return;
    }

    try {
      const formatted = new Date(String(publishedAt)).toISOString().split('T')[0];
      setPublishedDate(formatted);
    } catch (e) {
      console.error('Error formatting date:', e);
      setPublishedDate('');
    }
  }, [publishedAt]);

  return { publishedDate, setPublishedDate };
}
