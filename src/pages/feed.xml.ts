import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getAllPublications } from '../lib/supabase';

export const GET: APIRoute = async ({ site }) => {
  const publications = await getAllPublications();

  const feedTitle = 'BFSI Insights – Latest Publications';
  const feedDescription =
    'Agentic AI insights for executives and professionals in banking, financial services and insurance.';

  const items = [...publications]
    .filter((item) => item.date_added)
    .sort((a, b) => {
      const da = new Date(a.date_added).getTime();
      const db = new Date(b.date_added).getTime();
      return db - da;
    })
    .slice(0, 50)
    .map((item) => {
      const categories = [item.role, item.industry, item.topic].filter((c): c is string =>
        Boolean(c),
      );

      const author =
        Array.isArray(item.authors) && item.authors.length > 0
          ? String(item.authors[0])
          : undefined;

      const description =
        (item as any).note && typeof (item as any).note === 'string'
          ? (item as any).note
          : (item.source_name ?? '').trim() || undefined;

      return {
        title: item.title,
        description,
        link: item.url,
        pubDate: new Date(item.date_added),
        categories,
        author,
      };
    });

  return rss({
    title: feedTitle,
    description: feedDescription,
    site: site ?? new URL('https://www.bfsiinsights.com/'),
    items,
    stylesheet: true,
  });
};
