import { createClient } from '@supabase/supabase-js';
import { normalizeAuthors } from './authors';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ------------------------------------------------------------
// Publication type based on kb_publication_pretty view
// ------------------------------------------------------------
export interface Publication {
  id: string;
  slug: string;
  title: string;
  authors: string[]; // always array
  url: string;
  source_name: string | null;
  date_published: string | null;
  date_added: string | null;
  last_edited: string | null;
  thumbnail: string | null;
  thumbnail_bucket?: string | null;
  thumbnail_path?: string | null;

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
  regulators?: string[];
  regulations?: string[];

  use_cases: string | null;
  agentic_capabilities: string | null;

  status: string;
}

// normalizeAuthors imported from ./authors

// ------------------------------------------------------------
// Normalize a single publication row
// ------------------------------------------------------------
function normalizePublication(row: any): Publication {
  return {
    ...row,
    authors: normalizeAuthors(row.authors),
  };
}

// ------------------------------------------------------------
// Fetch all published publications
// ------------------------------------------------------------
export async function getAllPublications(): Promise<Publication[]> {
  const { data, error } = await supabase
    .from('kb_publication_pretty')
    .select('*')
    .eq('status', 'published')
    .order('date_published', { ascending: false });

  if (error) {
    console.error('Error fetching publications:', error);
    return [];
  }

  return (data || []).map(normalizePublication);
}

// ------------------------------------------------------------
// Fetch a single publication by slug
// ------------------------------------------------------------
export async function getPublicationBySlug(slug: string): Promise<Publication | null> {
  const { data, error } = await supabase
    .from('kb_publication_pretty')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    console.error(`Error fetching publication with slug "${slug}":`, error.message);
    return null;
  }

  return data ? normalizePublication(data) : null;
}

// ------------------------------------------------------------
// Fetch publications using arbitrary filters
// ------------------------------------------------------------
export async function getFilteredPublications(
  filters: Record<string, string>,
): Promise<Publication[]> {
  let query = supabase.from('kb_publication_pretty').select('*').eq('status', 'published');

  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query.order('date_added', { ascending: false });

  if (error) {
    console.error('Error fetching filtered publications:', error);
    return [];
  }

  return (data || []).map(normalizePublication);
}
