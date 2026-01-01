import type { Source } from '@/types/database';
import type { SourceHealth } from '../types';

interface SourceTableProps {
  sources: Source[];
  healthData: Map<string, SourceHealth>;
  onToggleEnabled: (source: Source) => void;
  onEdit: (source: Source) => void;
  formatTimeAgo: (date: string | null) => string;
  getHealthBadge: (health: SourceHealth | undefined) => {
    icon: string;
    label: string;
    className: string;
  };
  getDiscoveryInfo: (source: Source) => Array<{ icon: string; label: string; url: string | null }>;
  getCategoryColor: (category: string) => string;
}

export function SourceTable({
  sources,
  healthData,
  onToggleEnabled,
  onEdit,
  formatTimeAgo,
  getHealthBadge,
  getDiscoveryInfo,
  getCategoryColor,
}: SourceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full">
        <thead className="bg-neutral-900">
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Discovery</th>
            <th className="px-4 py-3">Health</th>
            <th className="px-4 py-3">Last Run</th>
            <th className="px-4 py-3">Items (7d)</th>
            <th className="px-4 py-3">Enabled</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {sources.map((source) => {
            const health = healthData.get(source.slug);
            const healthBadge = getHealthBadge(health);
            const discoveryMethods = getDiscoveryInfo(source);

            return (
              <tr key={source.slug} className="hover:bg-neutral-800/50">
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
                    <div className="text-xs text-red-400 mt-1 ml-8">
                      ⚠️ {source.disabled_reason}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${getCategoryColor(source.category)}`}
                  >
                    {source.category || '-'}
                  </span>
                  {source.tier === 'premium' && (
                    <span className="ml-1 text-xs text-amber-400">★</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {discoveryMethods.length > 0 ? (
                      discoveryMethods.map((method, i) => (
                        <span
                          key={i}
                          title={`${method.label}${method.url ? `: ${method.url}` : ''}`}
                          className="cursor-help"
                        >
                          {method.icon}
                        </span>
                      ))
                    ) : (
                      <span className="text-neutral-600" title="No discovery configured">
                        ❌
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`text-sm ${healthBadge.className}`}
                    title={`${healthBadge.label}${health ? ` (${health.error_rate}% errors)` : ''}`}
                  >
                    {healthBadge.icon}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs text-neutral-400">
                    {formatTimeAgo(health?.last_discovery || null)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`text-sm ${health?.items_7d ? 'text-white' : 'text-neutral-600'}`}
                  >
                    {health?.items_7d || 0}
                  </span>
                  {health?.failed_7d ? (
                    <span className="text-xs text-red-400 ml-1">({health.failed_7d} failed)</span>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <button
                    onClick={() => onToggleEnabled(source)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      source.enabled ? 'bg-emerald-500' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                        source.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>

                <td className="px-4 py-3">
                  <button
                    onClick={() => onEdit(source)}
                    className="text-sky-400 hover:text-sky-300 text-xs"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
