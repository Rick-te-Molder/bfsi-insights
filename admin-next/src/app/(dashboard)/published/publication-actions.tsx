'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PublicationActionsProps {
  publicationId: string;
  title: string;
  queueItemId: string | null;
  sourceUrl: string;
}

export function PublicationActions({
  publicationId,
  title,
  queueItemId,
  sourceUrl,
}: PublicationActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${title}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/publications/${publicationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={
          queueItemId
            ? `/review?id=${queueItemId}`
            : `/review?url=${encodeURIComponent(sourceUrl)}&status=all`
        }
        className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-800"
      >
        View Source
      </a>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '...' : '🗑️ Delete'}
      </button>
    </div>
  );
}
