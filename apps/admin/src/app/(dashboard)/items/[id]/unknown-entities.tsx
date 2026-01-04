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

function getEntityKey(entity: UnknownEntity): string {
  return `${entity.entityType}:${entity.name}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function submitProposal(
  entity: UnknownEntity,
  effectiveType: EntityType,
  sourceQueueId: string,
  sourceUrl: string,
) {
  const res = await fetch('/api/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: effectiveType,
      name: entity.name,
      slug: generateSlug(entity.name),
      source_queue_id: sourceQueueId,
      source_url: sourceUrl,
      metadata: {},
    }),
  });
  return {
    ok: res.ok || res.status === 409,
    error: res.ok || res.status === 409 ? null : (await res.json()).error,
  };
}

function PanelHeader({
  count,
  onProposeAll,
}: Readonly<{ count: number; onProposeAll: () => void }>) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-amber-300">⚠️ Unknown Entities ({count})</h2>
      <button
        onClick={onProposeAll}
        className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500"
      >
        Propose All
      </button>
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
  disabled,
}: Readonly<{ value: EntityType; onChange: (v: EntityType) => void; disabled: boolean }>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as EntityType)}
      disabled={disabled}
      className="text-xs bg-neutral-700 border border-neutral-600 rounded px-1.5 py-1 text-neutral-200 disabled:opacity-50"
    >
      {ENTITY_TYPE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ProposeButton({
  isLoading,
  onPropose,
}: Readonly<{ isLoading: boolean; onPropose: () => void }>) {
  return (
    <button
      onClick={onPropose}
      disabled={isLoading}
      className="text-xs px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 whitespace-nowrap"
    >
      {isLoading ? '...' : '+ Add'}
    </button>
  );
}

function ProposedBadge() {
  return <span className="text-xs text-emerald-400 whitespace-nowrap">✓ Proposed</span>;
}

function EntityRow({
  entity,
  isProposed,
  isLoading,
  effectiveType,
  onCategoryChange,
  onPropose,
}: Readonly<{
  entity: UnknownEntity;
  isProposed: boolean;
  isLoading: boolean;
  effectiveType: EntityType;
  onCategoryChange: (t: EntityType) => void;
  onPropose: () => void;
}>) {
  return (
    <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CategorySelect value={effectiveType} onChange={onCategoryChange} disabled={isProposed} />
        <span className="text-sm text-white truncate">{entity.name}</span>
      </div>
      {isProposed ? (
        <ProposedBadge />
      ) : (
        <ProposeButton isLoading={isLoading} onPropose={onPropose} />
      )}
    </div>
  );
}

function useEntityProposal(
  sourceQueueId: string,
  sourceUrl: string,
  categoryOverrides: Record<string, EntityType>,
) {
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const getEffectiveType = (entity: UnknownEntity): EntityType =>
    categoryOverrides[getEntityKey(entity)] || entity.entityType;

  const handlePropose = async (entity: UnknownEntity) => {
    const key = getEntityKey(entity);
    setLoading(key);
    const result = await submitProposal(entity, getEffectiveType(entity), sourceQueueId, sourceUrl);
    if (result.ok) {
      setProposed((prev) => new Set([...prev, key]));
      router.refresh();
    } else if (result.error) alert(`Failed to propose: ${result.error}`);
    setLoading(null);
  };

  return { proposed, loading, getEffectiveType, handlePropose };
}

interface EntityListProps {
  unknownEntities: UnknownEntity[];
  proposed: Set<string>;
  loading: string | null;
  getEffectiveType: (e: UnknownEntity) => EntityType;
  handleCategoryChange: (e: UnknownEntity, t: EntityType) => void;
  handlePropose: (e: UnknownEntity) => void;
}

function EntityList({
  unknownEntities,
  proposed,
  loading,
  getEffectiveType,
  handleCategoryChange,
  handlePropose,
}: Readonly<EntityListProps>) {
  return (
    <div className="space-y-2">
      {unknownEntities.map((entity) => (
        <EntityRow
          key={getEntityKey(entity)}
          entity={entity}
          isProposed={proposed.has(getEntityKey(entity))}
          isLoading={loading === getEntityKey(entity)}
          effectiveType={getEffectiveType(entity)}
          onCategoryChange={(t) => handleCategoryChange(entity, t)}
          onPropose={() => handlePropose(entity)}
        />
      ))}
    </div>
  );
}

function PanelDescription() {
  return (
    <p className="text-sm text-neutral-400 mb-4">
      These entities are not in the reference tables. Select the correct category and propose:
    </p>
  );
}

function usePanelState(sourceQueueId: string, sourceUrl: string) {
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, EntityType>>({});
  const { proposed, loading, getEffectiveType, handlePropose } = useEntityProposal(
    sourceQueueId,
    sourceUrl,
    categoryOverrides,
  );
  const handleCategoryChange = (entity: UnknownEntity, newType: EntityType) =>
    setCategoryOverrides((prev) => ({ ...prev, [getEntityKey(entity)]: newType }));
  return { proposed, loading, getEffectiveType, handlePropose, handleCategoryChange };
}

export function UnknownEntitiesPanel({
  unknownEntities,
  sourceQueueId,
  sourceUrl,
}: Readonly<UnknownEntitiesPanelProps>) {
  const { proposed, loading, getEffectiveType, handlePropose, handleCategoryChange } =
    usePanelState(sourceQueueId, sourceUrl);
  if (unknownEntities.length === 0) return null;
  const handleProposeAll = async () => {
    for (const e of unknownEntities) if (!proposed.has(getEntityKey(e))) await handlePropose(e);
  };
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <PanelHeader count={unknownEntities.length} onProposeAll={handleProposeAll} />
      <PanelDescription />
      <EntityList
        unknownEntities={unknownEntities}
        proposed={proposed}
        loading={loading}
        getEffectiveType={getEffectiveType}
        handleCategoryChange={handleCategoryChange}
        handlePropose={handlePropose}
      />
    </div>
  );
}
