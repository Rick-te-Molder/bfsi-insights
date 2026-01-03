'use client';

import { useRouter } from 'next/navigation';

interface SourceFilterProps {
  sources: Array<{ slug: string; name: string }>;
  currentSource: string;
  baseUrl: string;
}

export function SourceFilter({ sources, currentSource, baseUrl }: SourceFilterProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const url = new URL(baseUrl, window.location.origin);
    if (value) {
      url.searchParams.set('source', value);
    } else {
      url.searchParams.delete('source');
    }
    router.push(url.pathname + url.search);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">Source:</span>
      <select
        value={currentSource}
        onChange={handleChange}
        className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 border-none focus:ring-1 focus:ring-sky-500"
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
