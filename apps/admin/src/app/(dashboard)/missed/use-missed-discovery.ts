'use client';

import { useState, useEffect } from 'react';
import { useMissedItemsLoader } from './use-missed-items-loader';

export type MissedTab = 'report' | 'list';

export function useMissedDiscovery() {
  const [activeTab, setActiveTab] = useState<MissedTab>('report');
  const { missedItems, loadingList, loadMissedItems } = useMissedItemsLoader();

  useEffect(() => {
    if (activeTab === 'list') loadMissedItems();
  }, [activeTab, loadMissedItems]);

  return { activeTab, setActiveTab, missedItems, loadingList, loadMissedItems };
}
