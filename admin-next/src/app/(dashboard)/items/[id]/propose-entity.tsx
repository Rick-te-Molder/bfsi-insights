'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposeEntityProps {
  entityType: 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';
  name: string;
  sourceQueueId: string;
  sourceUrl: string;
}

export function ProposeEntityButton({
  entityType,
  name,
  sourceQueueId,
  sourceUrl,
}: ProposeEntityProps) {
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState(false);
  const router = useRouter();

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const handlePropose = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          name,
          slug,
          source_queue_id: sourceQueueId,
          source_url: sourceUrl,
          metadata: {},
        }),
      });

      if (res.ok) {
        setProposed(true);
        router.refresh();
      } else {
        const data = await res.json();
        if (res.status === 409) {
          setProposed(true); // Already proposed
        } else {
          alert(`Failed to propose: ${data.error}`);
        }
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  if (proposed) {
    return <span className="text-xs text-sky-400">📋 Proposed</span>;
  }

  return (
    <button
      onClick={handlePropose}
      disabled={loading}
      className="text-xs text-sky-400 hover:text-sky-300 underline disabled:opacity-50"
      title={`Propose adding "${name}" as ${entityType}`}
    >
      {loading ? '...' : '+ Add'}
    </button>
  );
}
