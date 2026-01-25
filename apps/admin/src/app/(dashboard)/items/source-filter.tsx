'use client';

import { useRouter } from 'next/navigation';

interface SourceFilterProps {
  sources: Array<{ slug: string; name: string }>;
  currentSource: string;
  baseUrl: string;
}

function useSourceChange(baseUrl: string) {
  const router = useRouter();
  return (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(baseUrl, globalThis.location.origin);
    if (e.target.value) url.searchParams.set('source', e.target.value);
    else url.searchParams.delete('source');
    router.push(url.pathname + url.search);
  };
}

function SourceOptions({ sources }: Readonly<{ sources: SourceFilterProps['sources'] }>) {
  return (
    <>
      {sources.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.name}
        </option>
      ))}
    </>
  );
}

export function SourceFilter({ sources, currentSource, baseUrl }: Readonly<SourceFilterProps>) {
  const handleChange = useSourceChange(baseUrl);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">Source:</span>
      <select
        value={currentSource}
        onChange={handleChange}
        className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 border-none focus:ring-1 focus:ring-sky-500"
      >
        <option value="">All sources</option>
        <SourceOptions sources={sources} />
      </select>
    </div>
  );
}
