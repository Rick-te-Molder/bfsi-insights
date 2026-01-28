import { useState, useEffect } from 'react';
import type { QueueItem } from '@bfsi/types';

interface Lookups {
  regulators: string[];
  standardSetters: string[];
  organizations: string[];
  vendors: string[];
}

async function fetchItemData(itemId: string) {
  const res = await fetch(`/api/queue-item/${itemId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch item: ${res.status}`);
  }
  return res.json();
}

function handleFetchSuccess(
  data: any,
  setItem: (item: QueueItem | null) => void,
  setLookups: (lookups: Lookups | null) => void,
) {
  if (data.item) {
    setItem(data.item);
    setLookups(data.lookups);
  } else {
    console.error('API returned no item:', data);
    setItem(null);
  }
}

function handleFetchError(err: unknown, setItem: (item: QueueItem | null) => void) {
  console.error('Failed to fetch item details:', err);
  setItem(null);
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
    fetchItemData(itemId)
      .then((data) => handleFetchSuccess(data, setItem, setLookups))
      .catch((err) => handleFetchError(err, setItem))
      .finally(() => setLoading(false));
  }, [itemId]);

  return { item, lookups, loading };
}
