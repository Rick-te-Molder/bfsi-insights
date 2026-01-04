import type { MissedDiscovery } from '../types';

function getUrgencyClass(urgency: string | null): string {
  if (urgency === 'critical') return 'text-red-400';
  if (urgency === 'important') return 'text-amber-400';
  return 'text-neutral-400';
}

function getResolutionStatusClass(status: string): string {
  if (status === 'pending') return 'bg-neutral-700 text-neutral-300';
  if (status === 'source_added') return 'bg-emerald-500/20 text-emerald-300';
  return 'bg-sky-500/20 text-sky-300';
}

const HEADER_CLASS = 'px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase';

function TableHeader() {
  return (
    <thead className="bg-neutral-800/50">
      <tr>
        <th className={HEADER_CLASS}>Domain</th>
        <th className={HEADER_CLASS}>Submitter</th>
        <th className={HEADER_CLASS}>Why Valuable</th>
        <th className={HEADER_CLASS}>Urgency</th>
        <th className={HEADER_CLASS}>Status</th>
        <th className={HEADER_CLASS}>Date</th>
      </tr>
    </thead>
  );
}

function DomainCell({ item }: { item: MissedDiscovery }) {
  return (
    <td className="px-4 py-3">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 hover:underline text-sm"
      >
        {item.source_domain}
      </a>
      {item.existing_source_slug && <span className="ml-2 text-xs text-amber-400">(tracked)</span>}
    </td>
  );
}

function SubmitterCell({ item }: { item: MissedDiscovery }) {
  return (
    <td className="px-4 py-3">
      <div className="text-sm text-white">{item.submitter_name || '—'}</div>
      {item.submitter_audience && (
        <div className="text-xs text-neutral-500 capitalize">
          {item.submitter_audience.replace('_', ' ')}
        </div>
      )}
    </td>
  );
}

function MissedRow({ item }: { item: MissedDiscovery }) {
  return (
    <tr key={item.id} className="hover:bg-neutral-800/30">
      <DomainCell item={item} />
      <SubmitterCell item={item} />
      <td className="px-4 py-3">
        <p className="text-sm text-neutral-300 line-clamp-2 max-w-xs">{item.why_valuable || '—'}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm ${getUrgencyClass(item.submitter_urgency)}`}>
          {item.submitter_urgency || '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-1 rounded text-xs ${getResolutionStatusClass(item.resolution_status)}`}
        >
          {item.resolution_status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">
        {new Date(item.submitted_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

interface MissedListProps {
  items: MissedDiscovery[];
  loading: boolean;
}

export function MissedList({ items, loading }: MissedListProps) {
  if (loading) return <div className="p-8 text-center text-neutral-500">Loading...</div>;
  if (items.length === 0)
    return (
      <div className="p-8 text-center text-neutral-500">No missed discoveries reported yet</div>
    );

  return (
    <table className="w-full">
      <TableHeader />
      <tbody className="divide-y divide-neutral-800">
        {items.map((item) => (
          <MissedRow key={item.id} item={item} />
        ))}
      </tbody>
    </table>
  );
}
