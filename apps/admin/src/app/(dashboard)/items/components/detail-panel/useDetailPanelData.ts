import { useState, useEffect } from 'react';
import type { QueueItem } from '@bfsi/types';

interface Lookups {
  regulators: string[];
  standardSetters: string[];
  organizations: string[];
  vendors: string[];
}

export function useDetailPanelData(itemId: string | null) {
  const [item, setItem] = useState<QueueItem | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }

    setLoading(true);
    fetch(`/api/queue-item/${itemId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch item: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.item) {
          setItem(data.item);
          setLookups(data.lookups);
        } else {
          console.error('API returned no item:', data);
          setItem(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch item details:', err);
        setItem(null);
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  return { item, lookups, loading };
}
