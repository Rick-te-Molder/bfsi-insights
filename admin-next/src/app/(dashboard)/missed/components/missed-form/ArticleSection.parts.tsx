import type { ExistingSource } from './types';

export function ArticleHeader() {
  return (
    <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">The Article</h2>
  );
}

export function UrlField({ url, setUrl }: { url: string; setUrl: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
        URL <span className="text-red-400">*</span>
      </label>
      <input
        type="url"
        id="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        placeholder="https://example.com/article"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}

export function DomainHint({
  detectedDomain,
  existingSource,
}: {
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
}) {
  if (!detectedDomain) return null;

  const existingLabel = existingSource ? (existingSource.name ?? existingSource.slug) : null;

  return (
    <p className="mt-2 text-sm">
      {existingLabel ? (
        <span className="text-amber-400">
          ⚠️ We track <strong>{existingLabel}</strong> — why did we miss this?
        </span>
      ) : (
        <span className="text-sky-400">
          ⚡ New domain: <strong>{detectedDomain}</strong> (not tracked)
        </span>
      )}
    </p>
  );
}
