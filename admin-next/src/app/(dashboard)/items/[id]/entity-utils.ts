import { createServiceRoleClient } from '@/lib/supabase/server';

export interface LookupTables {
  regulators: Set<string>;
  standardSetters: Set<string>;
  organizations: Set<string>;
  vendors: Set<string>;
}

export interface UnknownEntity {
  entityType: 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';
  name: string;
  label: string;
}

export async function getLookupTables(): Promise<LookupTables> {
  const supabase = createServiceRoleClient();

  const [regulatorsRes, standardSettersRes, orgsRes, vendorsRes] = await Promise.all([
    supabase.from('regulator').select('slug'),
    supabase.from('standard_setter').select('slug'),
    supabase.from('bfsi_organization').select('slug'),
    supabase.from('ag_vendor').select('slug'),
  ]);

  return {
    regulators: new Set((regulatorsRes.data || []).map((r) => r.slug)),
    standardSetters: new Set((standardSettersRes.data || []).map((s) => s.slug)),
    organizations: new Set((orgsRes.data || []).map((o) => o.slug)),
    vendors: new Set((vendorsRes.data || []).map((v) => v.slug)),
  };
}

export async function getProposedEntities(sourceQueueId: string) {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('proposed_entity')
    .select('entity_type, name, slug')
    .eq('source_queue_id', sourceQueueId)
    .eq('status', 'pending');

  return data || [];
}

export function calculateUnknownEntities(
  payload: Record<string, unknown>,
  lookups: LookupTables,
  proposedEntities: Array<{ entity_type: string; name: string; slug: string }>,
): UnknownEntity[] {
  const unknownEntities: UnknownEntity[] = [];

  // Build set of already-proposed entities to filter out
  const proposedSet = new Set(
    proposedEntities.map((p) => `${p.entity_type}:${p.name.toLowerCase()}`),
  );

  const isAlreadyProposed = (entityType: string, name: string) => {
    return proposedSet.has(`${entityType}:${name.toLowerCase()}`);
  };

  for (const name of (payload.organization_names as string[]) || []) {
    if (
      !lookups.organizations.has(name.toLowerCase()) &&
      !isAlreadyProposed('bfsi_organization', name)
    ) {
      unknownEntities.push({ entityType: 'bfsi_organization', name, label: 'Organization' });
    }
  }
  for (const name of (payload.vendor_names as string[]) || []) {
    if (!lookups.vendors.has(name.toLowerCase()) && !isAlreadyProposed('ag_vendor', name)) {
      unknownEntities.push({ entityType: 'ag_vendor', name, label: 'Vendor' });
    }
  }
  for (const code of (payload.regulator_codes as string[]) || []) {
    if (!lookups.regulators.has(code.toLowerCase()) && !isAlreadyProposed('regulator', code)) {
      unknownEntities.push({ entityType: 'regulator', name: code, label: 'Regulator' });
    }
  }
  for (const code of (payload.standard_setter_codes as string[]) || []) {
    if (
      !lookups.standardSetters.has(code.toLowerCase()) &&
      !isAlreadyProposed('standard_setter', code)
    ) {
      unknownEntities.push({ entityType: 'standard_setter', name: code, label: 'Standard Setter' });
    }
  }

  return unknownEntities;
}
