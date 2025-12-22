'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EntityType = 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';

interface UnknownEntity {
  entityType: EntityType;
  name: string;
  label: string;
}

interface UnknownEntitiesPanelProps {
  unknownEntities: UnknownEntity[];
  sourceQueueId: string;
  sourceUrl: string;
}

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'bfsi_organization', label: 'BFSI Organization' },
  { value: 'ag_vendor', label: 'Vendor' },
  { value: 'regulator', label: 'Regulator' },
  { value: 'standard_setter', label: 'Standard Setter' },
];

export function UnknownEntitiesPanel({
  unknownEntities,
  sourceQueueId,
  sourceUrl,
}: UnknownEntitiesPanelProps) {
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  // Track category overrides for each entity
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, EntityType>>({});
  const router = useRouter();

  if (unknownEntities.length === 0) {
    return null;
  }

  // Get effective entity type (override or original)
  const getEffectiveType = (entity: UnknownEntity): EntityType => {
    const key = `${entity.entityType}:${entity.name}`;
    return categoryOverrides[key] || entity.entityType;
  };

  const handleCategoryChange = (entity: UnknownEntity, newType: EntityType) => {
    const key = `${entity.entityType}:${entity.name}`;
    setCategoryOverrides((prev) => ({ ...prev, [key]: newType }));
  };

  const handlePropose = async (entity: UnknownEntity) => {
    const key = `${entity.entityType}:${entity.name}`;
    setLoading(key);

    const effectiveType = getEffectiveType(entity);
    const slug = entity.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: effectiveType,
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
        These entities are not in the reference tables. Select the correct category and propose:
      </p>

      <div className="space-y-2">
        {unknownEntities.map((entity) => {
          const key = `${entity.entityType}:${entity.name}`;
          const isProposed = proposed.has(key);
          const isLoading = loading === key;
          const effectiveType = getEffectiveType(entity);

          return (
            <div
              key={key}
              className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2 gap-2"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
                  value={effectiveType}
                  onChange={(e) => handleCategoryChange(entity, e.target.value as EntityType)}
                  disabled={isProposed}
                  className="text-xs bg-neutral-700 border border-neutral-600 rounded px-1.5 py-1 text-neutral-200 disabled:opacity-50"
                >
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-white truncate">{entity.name}</span>
              </div>

              {isProposed ? (
                <span className="text-xs text-emerald-400 whitespace-nowrap">✓ Proposed</span>
              ) : (
                <button
                  onClick={() => handlePropose(entity)}
                  disabled={isLoading}
                  className="text-xs px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 whitespace-nowrap"
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
