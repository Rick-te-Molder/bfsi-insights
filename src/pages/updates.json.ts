import { getAllResources } from '../lib/supabase';

export async function GET() {
  const resources = await getAllResources();
  const latest = resources.slice(0, 20).map((item) => ({
    title: item.title,
    url: item.url,
    date_added: item.date_added,
    last_edited: item.last_edited,
    source_name: item.source_name,
    role: item.role,
    industry: item.industry,
    topic: item.topic,
    content_type: item.content_type,
    jurisdiction: item.jurisdiction,
  }));

  return new Response(JSON.stringify({ items: latest }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
