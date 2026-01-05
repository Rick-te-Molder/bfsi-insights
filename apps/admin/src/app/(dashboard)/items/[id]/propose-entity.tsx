'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposeEntityProps {
  entityType: 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';
  name: string;
  sourceQueueId: string;
  sourceUrl: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/, '-')
    .replaceAll(/(^-)|(-$)/, '');
}

async function proposeEntity(
  props: ProposeEntityProps,
  slug: string,
): Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: props.entityType,
        name: props.name,
        slug,
        source_queue_id: props.sourceQueueId,
        source_url: props.sourceUrl,
        metadata: {},
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 409) return { ok: true, alreadyExists: true };
    const data = await res.json();
    return { ok: false, error: data.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

function ProposedBadge() {
  return <span className="text-xs text-sky-400">📋 Proposed</span>;
}

function ProposeButton({
  loading,
  onClick,
  name,
  entityType,
}: Readonly<{ loading: boolean; onClick: () => void; name: string; entityType: string }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-xs text-sky-400 hover:text-sky-300 underline disabled:opacity-50"
      title={`Propose adding "${name}" as ${entityType}`}
    >
      {loading ? '...' : '+ Add'}
    </button>
  );
}

export function ProposeEntityButton(props: Readonly<ProposeEntityProps>) {
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState(false);
  const router = useRouter();
  const slug = generateSlug(props.name);

  const handlePropose = async () => {
    setLoading(true);
    const result = await proposeEntity(props, slug);
    if (result.ok) {
      setProposed(true);
      router.refresh();
    } else if (result.error) alert(`Failed to propose: ${result.error}`);
    setLoading(false);
  };

  if (proposed) return <ProposedBadge />;
  return (
    <ProposeButton
      loading={loading}
      onClick={handlePropose}
      name={props.name}
      entityType={props.entityType}
    />
  );
}
