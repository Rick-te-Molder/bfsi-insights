import type { MissedDiscovery } from '../types';

interface MissedListProps {
  items: MissedDiscovery[];
  loading: boolean;
}

export function MissedList({ items, loading }: MissedListProps) {
  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Loading...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500">No missed discoveries reported yet</div>
    );
  }

  return (
    <table className="w-full">
      <thead className="bg-neutral-800/50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Domain
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Submitter
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Why Valuable
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Urgency
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Status
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
            Date
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-neutral-800/30">
            <td className="px-4 py-3">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline text-sm"
              >
                {item.source_domain}
              </a>
              {item.existing_source_slug && (
                <span className="ml-2 text-xs text-amber-400">(tracked)</span>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="text-sm text-white">{item.submitter_name || '—'}</div>
              {item.submitter_audience && (
                <div className="text-xs text-neutral-500 capitalize">
                  {item.submitter_audience.replace('_', ' ')}
                </div>
              )}
            </td>
            <td className="px-4 py-3">
              <p className="text-sm text-neutral-300 line-clamp-2 max-w-xs">
                {item.why_valuable || '—'}
              </p>
            </td>
            <td className="px-4 py-3">
              <span
                className={`text-sm ${
                  item.submitter_urgency === 'critical'
                    ? 'text-red-400'
                    : item.submitter_urgency === 'important'
                      ? 'text-amber-400'
                      : 'text-neutral-400'
                }`}
              >
                {item.submitter_urgency || '—'}
              </span>
            </td>
            <td className="px-4 py-3">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  item.resolution_status === 'pending'
                    ? 'bg-neutral-700 text-neutral-300'
                    : item.resolution_status === 'source_added'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-sky-500/20 text-sky-300'
                }`}
              >
                {item.resolution_status}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-neutral-500">
              {new Date(item.submitted_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
