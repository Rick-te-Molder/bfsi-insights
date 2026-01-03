import type { ExistingSource } from './types';
import { ArticleHeader, DomainHint, UrlField } from './ArticleSection.parts';

export function ArticleSection({
  url,
  setUrl,
  detectedDomain,
  existingSource,
}: {
  url: string;
  setUrl: (v: string) => void;
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <ArticleHeader />
      <UrlField url={url} setUrl={setUrl} />
      <DomainHint detectedDomain={detectedDomain} existingSource={existingSource} />
    </div>
  );
}
