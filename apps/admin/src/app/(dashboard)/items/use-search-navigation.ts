'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

export function useSearchNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set('search', query.trim());
        params.delete('status'); // Show all statuses when searching
      } else {
        params.delete('search');
      }
      router.push(`/items?${params.toString()}`);
    },
    [query, router, searchParams],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    router.push(`/items?${params.toString()}`);
  }, [router, searchParams]);

  return { query, setQuery, handleSearch, handleClear };
}
