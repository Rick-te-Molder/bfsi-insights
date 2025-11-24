import { getAllPublications } from '../lib/supabase';

export async function GET() {
  const publications = await getAllPublications();
  const latest = publications.slice(0, 20).map((item) => ({
    title: item.title,
    url: item.url,
    date_added: item.date_added,
    last_edited: (item as any).last_edited, // keep if present in view, otherwise remove
    source_name: item.source_name,
    role: item.role,
    industry: item.industry,
    topic: item.topic,
    content_type: item.content_type,
    geography: item.geography,
  }));

  return new Response(JSON.stringify({ items: latest }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
