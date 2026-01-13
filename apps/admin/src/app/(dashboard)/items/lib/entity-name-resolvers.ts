import { SupabaseClient } from '@supabase/supabase-js';

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const v of values) {
    const name = normalizeName(v);
    if (name) result.push(name);
  }
  return [...new Set(result)];
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-)|(-$)/g, '');
}

async function resolveVendorIds(supabase: SupabaseClient, vendorNames: unknown): Promise<string[]> {
  const names = normalizeNames(vendorNames);
  if (names.length === 0) return [];

  const { error: upsertError } = await supabase.from('ag_vendor').upsert(
    names.map((name) => ({ name, slug: slugify(name) })),
    { onConflict: 'name', ignoreDuplicates: true },
  );
  if (upsertError) throw new Error(upsertError.message);

  const { data: vendorRows, error: selectError } = await supabase
    .from('ag_vendor')
    .select('id, name, aliases')
    .in('name', names);
  if (selectError) throw new Error(selectError.message);

  const map = buildVendorNameToIdMap(vendorRows);
  return extractIdsFromNameMap(map, names);
}

function buildVendorNameToIdMap(vendorRows: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(vendorRows)) return map;

  for (const row of vendorRows) {
    const extracted = extractVendorRow(row);
    if (!extracted) continue;
    mapVendorNames(map, extracted);
  }

  return map;
}

function extractVendorRow(
  row: unknown,
): { id: string; name: string | null; aliases: string[] | null } | null {
  if (!row || typeof row !== 'object') return null;

  const id = (row as { id?: unknown }).id;
  if (!id) return null;

  const name = (row as { name?: unknown }).name;
  const aliases = (row as { aliases?: unknown }).aliases;

  return {
    id: String(id),
    name: name ? String(name) : null,
    aliases: Array.isArray(aliases) ? aliases.map(String) : null,
  };
}

function mapVendorNames(
  map: Map<string, string>,
  row: { id: string; name: string | null; aliases: string[] | null },
) {
  if (row.name) map.set(row.name.toLowerCase(), row.id);
  if (!row.aliases) return;
  for (const alias of row.aliases) {
    if (alias) map.set(alias.toLowerCase(), row.id);
  }
}

function extractIdsFromNameMap(map: Map<string, string>, names: string[]): string[] {
  const ids: string[] = [];
  for (const name of names) {
    const id = map.get(name.toLowerCase());
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

async function resolveOrganizationIds(
  supabase: SupabaseClient,
  organizationNames: unknown,
): Promise<string[]> {
  const names = normalizeNames(organizationNames);
  if (names.length === 0) return [];

  const { error: upsertError } = await supabase.from('bfsi_organization').upsert(
    names.map((name) => ({ name, slug: slugify(name) })),
    { onConflict: 'name', ignoreDuplicates: true },
  );
  if (upsertError) throw new Error(upsertError.message);

  const { data: orgRows, error: selectError } = await supabase
    .from('bfsi_organization')
    .select('id, name')
    .in('name', names);
  if (selectError) throw new Error(selectError.message);

  const map = buildOrganizationNameToIdMap(orgRows);
  return extractIdsFromNameMap(map, names);
}

function buildOrganizationNameToIdMap(orgRows: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(orgRows)) return map;

  for (const row of orgRows) {
    if (!row || typeof row !== 'object') continue;

    const id = (row as { id?: unknown }).id;
    const name = (row as { name?: unknown }).name;
    if (id && name) map.set(String(name).toLowerCase(), String(id));
  }

  return map;
}

export async function resolveEntityIdsForTaxonomy(args: {
  supabase: SupabaseClient;
  payload: Record<string, unknown>;
  payloadField: string;
}): Promise<string[] | null> {
  if (args.payloadField === 'vendor_names') {
    return await resolveVendorIds(args.supabase, args.payload[args.payloadField]);
  }

  if (args.payloadField === 'organization_names') {
    return await resolveOrganizationIds(args.supabase, args.payload[args.payloadField]);
  }

  return null;
}
