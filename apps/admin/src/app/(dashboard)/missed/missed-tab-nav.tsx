import type { MissedTab } from './use-missed-discovery';

interface MissedTabNavProps {
  readonly activeTab: MissedTab;
  readonly onTabChange: (tab: MissedTab) => void;
  readonly itemCount: number;
}

function getTabClassName(isActive: boolean): string {
  const base = 'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors';
  return isActive
    ? `${base} bg-sky-600 text-white`
    : `${base} text-neutral-400 hover:text-white hover:bg-neutral-800`;
}

export function MissedTabNav({ activeTab, onTabChange, itemCount }: MissedTabNavProps) {
  return (
    <div className="flex gap-2 border-b border-neutral-800 pb-2">
      <button
        onClick={() => onTabChange('report')}
        className={getTabClassName(activeTab === 'report')}
      >
        ➕ Report Missed Article
      </button>
      <button onClick={() => onTabChange('list')} className={getTabClassName(activeTab === 'list')}>
        📋 View All ({itemCount || '...'})
      </button>
    </div>
  );
}
