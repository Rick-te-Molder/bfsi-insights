import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our resources
export interface Resource {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  date_published: string;
  date_added: string;
  last_edited: string;
  url: string;
  source_name: string;
  source_domain: string;
  thumbnail: string | null;
  summary_short: string;
  summary_medium: string;
  summary_long: string;
  note: string;
  role: string;
  content_type: string;
  jurisdiction: string;
  industry: string;
  topic: string;
  use_cases: string;
  agentic_capabilities: string;
  tags: string[];
  status: string;
  internal_notes: string | null;
}

// Helper to normalize authors field (DB stores as string, component expects array)
function normalizeResource(resource: any): Resource {
  return {
    ...resource,
    authors: resource.authors ? resource.authors.split(',').map((a: string) => a.trim()) : [],
  };
}

// Fetch all published resources
export async function getAllResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('kb_resource_pretty')
    .select('*')
    .eq('status', 'published')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }

  return (data || []).map(normalizeResource);
}

// Fetch a single resource by slug
export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('kb_resource_pretty')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    console.error(`Error fetching resource ${slug}:`, error);
    return null;
  }

  return data ? normalizeResource(data) : null;
}

// Fetch resources with filters
export async function getFilteredResources(filters: {
  role?: string;
  industry?: string;
  topic?: string;
  content_type?: string;
  jurisdiction?: string;
}): Promise<Resource[]> {
  let query = supabase.from('kb_resource_pretty').select('*').eq('status', 'published');

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.industry) query = query.eq('industry', filters.industry);
  if (filters.topic) query = query.eq('topic', filters.topic);
  if (filters.content_type) query = query.eq('content_type', filters.content_type);
  if (filters.jurisdiction) query = query.eq('jurisdiction', filters.jurisdiction);

  query = query.order('date_added', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching filtered resources:', error);
    return [];
  }

  return (data || []).map(normalizeResource);
}
