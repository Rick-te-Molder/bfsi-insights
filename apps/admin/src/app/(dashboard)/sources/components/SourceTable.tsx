import type { Source } from '@/types/database';
import type { SourceHealth } from '../types';

type HealthBadge = { icon: string; label: string; className: string };
type DiscoveryMethod = { icon: string; label: string; url: string | null };

interface SourceTableProps {
  sources: Source[];
  healthData: Map<string, SourceHealth>;
  onToggleEnabled: (source: Source) => void;
  onEdit: (source: Source) => void;
  formatTimeAgo: (date: string | null) => string;
  getHealthBadge: (health: SourceHealth | undefined) => HealthBadge;
  getDiscoveryInfo: (source: Source) => DiscoveryMethod[];
  getCategoryColor: (category: string) => string;
}

const HEADER_CLASS = 'px-4 py-3';

function TableHeader() {
  return (
    <thead className="bg-neutral-900">
      <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
        <th className={HEADER_CLASS}>Source</th>
        <th className={HEADER_CLASS}>Category</th>
        <th className={HEADER_CLASS}>Discovery</th>
        <th className={HEADER_CLASS}>Health</th>
        <th className={HEADER_CLASS}>Last Run</th>
        <th className={HEADER_CLASS}>Items (7d)</th>
        <th className={HEADER_CLASS}>Enabled</th>
        <th className={HEADER_CLASS}>Actions</th>
      </tr>
    </thead>
  );
}

function SourceCell({ source }: { source: Source }) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-700 text-xs font-medium">
          {source.sort_order ? Math.ceil(source.sort_order / 100) : '-'}
        </span>
        <div>
          <div className="font-medium text-white">{source.name}</div>
          <div className="text-xs text-neutral-500">{source.domain}</div>
        </div>
      </div>
      {source.disabled_reason && (
        <div className="text-xs text-red-400 mt-1 ml-8">⚠️ {source.disabled_reason}</div>
      )}
    </td>
  );
}

function CategoryCell({
  source,
  getCategoryColor,
}: {
  source: Source;
  getCategoryColor: (c: string) => string;
}) {
  return (
    <td className="px-4 py-3">
      <span className={`rounded-full px-2 py-0.5 text-xs ${getCategoryColor(source.category)}`}>
        {source.category || '-'}
      </span>
      {source.tier === 'premium' && <span className="ml-1 text-xs text-amber-400">★</span>}
    </td>
  );
}

function DiscoveryCell({ methods }: { methods: DiscoveryMethod[] }) {
  if (methods.length === 0) {
    return (
      <td className="px-4 py-3">
        <span className="text-neutral-600" title="No discovery configured">
          ❌
        </span>
      </td>
    );
  }
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-1">
        {methods.map((method) => {
          const urlSuffix = method.url ? `: ${method.url}` : '';
          return (
            <span key={method.label} title={`${method.label}${urlSuffix}`} className="cursor-help">
              {method.icon}
            </span>
          );
        })}
      </div>
    </td>
  );
}

function HealthCell({ health, badge }: { health: SourceHealth | undefined; badge: HealthBadge }) {
  const errorSuffix = health ? ` (${health.error_rate}% errors)` : '';
  return (
    <td className="px-4 py-3">
      <span className={`text-sm ${badge.className}`} title={`${badge.label}${errorSuffix}`}>
        {badge.icon}
      </span>
    </td>
  );
}

function ItemsCell({ health }: { health: SourceHealth | undefined }) {
  return (
    <td className="px-4 py-3">
      <span className={`text-sm ${health?.items_7d ? 'text-white' : 'text-neutral-600'}`}>
        {health?.items_7d || 0}
      </span>
      {health?.failed_7d ? (
        <span className="text-xs text-red-400 ml-1">({health.failed_7d} failed)</span>
      ) : null}
    </td>
  );
}

function ToggleCell({ source, onToggle }: { source: Source; onToggle: () => void }) {
  return (
    <td className="px-4 py-3">
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors ${source.enabled ? 'bg-emerald-500' : 'bg-neutral-700'}`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${source.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </td>
  );
}

function ActionsCell({ onEdit }: { onEdit: () => void }) {
  return (
    <td className="px-4 py-3">
      <button onClick={onEdit} className="text-sky-400 hover:text-sky-300 text-xs">
        Edit
      </button>
    </td>
  );
}

interface SourceRowProps {
  source: Source;
  health: SourceHealth | undefined;
  healthBadge: HealthBadge;
  discoveryMethods: DiscoveryMethod[];
  formatTimeAgo: (date: string | null) => string;
  getCategoryColor: (category: string) => string;
  onToggleEnabled: () => void;
  onEdit: () => void;
}

function SourceRow(props: SourceRowProps) {
  const {
    source,
    health,
    healthBadge,
    discoveryMethods,
    formatTimeAgo,
    getCategoryColor,
    onToggleEnabled,
    onEdit,
  } = props;
  return (
    <tr className="hover:bg-neutral-800/50">
      <SourceCell source={source} />
      <CategoryCell source={source} getCategoryColor={getCategoryColor} />
      <DiscoveryCell methods={discoveryMethods} />
      <HealthCell health={health} badge={healthBadge} />
      <td className="px-4 py-3">
        <span className="text-xs text-neutral-400">
          {formatTimeAgo(health?.last_discovery || null)}
        </span>
      </td>
      <ItemsCell health={health} />
      <ToggleCell source={source} onToggle={onToggleEnabled} />
      <ActionsCell onEdit={onEdit} />
    </tr>
  );
}

function TableBody(props: SourceTableProps) {
  const {
    sources,
    healthData,
    onToggleEnabled,
    onEdit,
    formatTimeAgo,
    getHealthBadge,
    getDiscoveryInfo,
    getCategoryColor,
  } = props;
  return (
    <tbody className="divide-y divide-neutral-800">
      {sources.map((source) => (
        <SourceRow
          key={source.slug}
          source={source}
          health={healthData.get(source.slug)}
          healthBadge={getHealthBadge(healthData.get(source.slug))}
          discoveryMethods={getDiscoveryInfo(source)}
          formatTimeAgo={formatTimeAgo}
          getCategoryColor={getCategoryColor}
          onToggleEnabled={() => onToggleEnabled(source)}
          onEdit={() => onEdit(source)}
        />
      ))}
    </tbody>
  );
}

export function SourceTable(props: SourceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full">
        <TableHeader />
        <TableBody {...props} />
      </table>
    </div>
  );
}
