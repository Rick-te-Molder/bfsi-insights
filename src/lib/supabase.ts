import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ------------------------------------------------------------
// Resource type based on kb_publication_pretty view
// ------------------------------------------------------------
export interface Resource {
  id: string;
  slug: string;
  title: string;
  authors: string[]; // always array
  url: string;
  source_name: string | null;
  date_published: string | null;
  date_added: string | null;
  thumbnail: string | null;

  summary_short: string | null;
  summary_medium: string | null;
  summary_long: string | null;

  role: string | null;
  content_type: string | null;
  geography: string | null;

  industry: string | null;
  topic: string | null;
  industries?: string[];
  topics?: string[];
  processes?: string[];

  use_cases: string | null;
  agentic_capabilities: string | null;

  status: string;
}

// ------------------------------------------------------------
// Normalize authors: DB stores as "John Doe, Jane Smith"
// ------------------------------------------------------------
function normalizeAuthors(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);

  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------
// Normalize a single resource row
// ------------------------------------------------------------
function normalizeResource(row: any): Resource {
  return {
    ...row,
    authors: normalizeAuthors(row.authors),
  };
}

// ------------------------------------------------------------
// Fetch all published resources
// ------------------------------------------------------------
export async function getAllResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('kb_publication_pretty')
    .select('*')
    .eq('status', 'published')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }

  return (data || []).map(normalizeResource);
}

// ------------------------------------------------------------
// Fetch a single resource by slug
// ------------------------------------------------------------
export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('kb_publication_pretty')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    console.error(`Error fetching resource with slug "${slug}":`, error.message);
    return null;
  }

  return data ? normalizeResource(data) : null;
}

// ------------------------------------------------------------
// Fetch resources using arbitrary filters
// ------------------------------------------------------------
export async function getFilteredResources(filters: Record<string, string>): Promise<Resource[]> {
  let query = supabase.from('kb_publication_pretty').select('*').eq('status', 'published');

  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query.order('date_added', { ascending: false });

  if (error) {
    console.error('Error fetching filtered resources:', error);
    return [];
  }

  return (data || []).map(normalizeResource);
}
