'use client';

import { MissedForm } from './components/MissedForm';
import { MissedList } from './components/MissedList';
import { useMissedDiscovery } from './use-missed-discovery';
import { MissedPageHeader } from './missed-page-header';
import { MissedTabNav } from './missed-tab-nav';

export default function MissedDiscoveryPage() {
  const { activeTab, setActiveTab, missedItems, loadingList, loadMissedItems } =
    useMissedDiscovery();

  return (
    <div className="space-y-6">
      <MissedPageHeader />
      <MissedTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        itemCount={missedItems.length}
      />
      {activeTab === 'report' ? (
        <MissedForm onSuccess={loadMissedItems} />
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <MissedList items={missedItems} loading={loadingList} />
        </div>
      )}
    </div>
  );
}
