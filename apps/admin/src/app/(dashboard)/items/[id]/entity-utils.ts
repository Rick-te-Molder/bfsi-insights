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

  const collectUnknowns = (
    values: string[],
    hasLookup: (v: string) => boolean,
    entityType: UnknownEntity['entityType'],
    label: string,
  ) => {
    for (const value of values) {
      if (!hasLookup(value) && !isAlreadyProposed(entityType, value)) {
        unknownEntities.push({ entityType, name: value, label });
      }
    }
  };

  collectUnknowns(
    (payload.organization_names as string[]) || [],
    (v) => lookups.organizations.has(v.toLowerCase()),
    'bfsi_organization',
    'Organization',
  );
  collectUnknowns(
    (payload.vendor_names as string[]) || [],
    (v) => lookups.vendors.has(v.toLowerCase()),
    'ag_vendor',
    'Vendor',
  );
  collectUnknowns(
    (payload.regulator_codes as string[]) || [],
    (v) => lookups.regulators.has(v.toLowerCase()),
    'regulator',
    'Regulator',
  );
  collectUnknowns(
    (payload.standard_setter_codes as string[]) || [],
    (v) => lookups.standardSetters.has(v.toLowerCase()),
    'standard_setter',
    'Standard Setter',
  );

  return unknownEntities;
}
