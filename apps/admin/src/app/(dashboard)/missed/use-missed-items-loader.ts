'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MissedDiscovery } from './types';

const MISSED_FIELDS =
  'id, url, source_domain, submitter_name, submitter_audience, why_valuable, submitter_urgency, resolution_status, submitted_at, existing_source_slug';

export function useMissedItemsLoader() {
  const [missedItems, setMissedItems] = useState<MissedDiscovery[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const supabase = createClient();

  const loadMissedItems = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('missed_discovery')
      .select(MISSED_FIELDS)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (!error && data) setMissedItems(data);
    setLoadingList(false);
  }, [supabase]);

  return { missedItems, loadingList, loadMissedItems };
}
