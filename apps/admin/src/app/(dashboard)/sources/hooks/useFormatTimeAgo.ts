import { useRef, useCallback } from 'react';

export function useFormatTimeAgo() {
  const nowRef = useRef<number | null>(null);
  // eslint-disable-next-line react-hooks/purity -- Date.now() computed once on mount for relative time display
  if (nowRef.current === null) nowRef.current = Date.now();

  return useCallback((date: string | null) => {
    if (!date) return 'Never';
    const diff = nowRef.current! - new Date(date).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }, []);
}
