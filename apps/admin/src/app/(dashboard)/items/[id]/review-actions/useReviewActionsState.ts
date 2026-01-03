import { useState } from 'react';
import type { QueueItem } from '@bfsi/types';

export function useReviewActionsState(item: QueueItem) {
  const [loading, setLoading] = useState<string | null>(null);
  const [title, setTitle] = useState((item.payload?.title as string) || '');

  return { loading, setLoading, title, setTitle };
}
