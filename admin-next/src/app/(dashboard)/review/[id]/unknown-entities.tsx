'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UnknownEntity {
  entityType: 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';
  name: string;
  label: string;
}

interface UnknownEntitiesPanelProps {
  unknownEntities: UnknownEntity[];
  sourceQueueId: string;
  sourceUrl: string;
}

export function UnknownEntitiesPanel({
  unknownEntities,
  sourceQueueId,
  sourceUrl,
}: UnknownEntitiesPanelProps) {
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  if (unknownEntities.length === 0) {
    return null;
  }

  const handlePropose = async (entity: UnknownEntity) => {
    const key = `${entity.entityType}:${entity.name}`;
    setLoading(key);

    const slug = entity.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entity.entityType,
          name: entity.name,
          slug,
          source_queue_id: sourceQueueId,
          source_url: sourceUrl,
          metadata: {},
        }),
      });

      if (res.ok || res.status === 409) {
        setProposed((prev) => new Set([...prev, key]));
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Failed to propose: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleProposeAll = async () => {
    for (const entity of unknownEntities) {
      const key = `${entity.entityType}:${entity.name}`;
      if (!proposed.has(key)) {
        await handlePropose(entity);
      }
    }
  };

  const entityTypeLabels: Record<string, string> = {
    regulator: 'Regulator',
    standard_setter: 'Std Setter',
    bfsi_organization: 'BFSI Org',
    ag_vendor: 'Vendor',
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-amber-300">
          ⚠️ Unknown Entities ({unknownEntities.length})
        </h2>
        <button
          onClick={handleProposeAll}
          className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500"
        >
          Propose All
        </button>
      </div>

      <p className="text-sm text-neutral-400 mb-4">
        These entities are not in the reference tables. Propose them for addition:
      </p>

      <div className="space-y-2">
        {unknownEntities.map((entity) => {
          const key = `${entity.entityType}:${entity.name}`;
          const isProposed = proposed.has(key);
          const isLoading = loading === key;

          return (
            <div
              key={key}
              className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">
                  {entityTypeLabels[entity.entityType]}:
                </span>
                <span className="text-sm text-white">{entity.name}</span>
              </div>

              {isProposed ? (
                <span className="text-xs text-emerald-400">✓ Proposed</span>
              ) : (
                <button
                  onClick={() => handlePropose(entity)}
                  disabled={isLoading}
                  className="text-xs px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {isLoading ? '...' : '+ Add'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
