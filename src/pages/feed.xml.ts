import rss from '@astrojs/rss';
import resources from '../data/resources/resources.json';

export function GET(context) {
  const site = context.site?.toString() ?? 'https://www.bfsiinsights.com/';
  const title = 'BFSI Insights – Latest Resources';
  const description =
    'Agentic AI insights for executives and professionals in banking, financial services and insurance.';

  const items = [...resources]
    .sort((a, b) => b.date_added.localeCompare(a.date_added))
    .slice(0, 50)
    .map((item) => ({
      title: item.title,
      description: item.note || `${item.source_name ?? ''}`.trim(),
      // Link directly to the external resource URL
      link: item.url,
      pubDate: new Date(item.date_added),
      categories: [item.role, item.industry, item.topic].filter(Boolean) as string[],
      author: Array.isArray(item.authors) && item.authors.length ? item.authors[0] : undefined,
    }));

  return rss({
    title,
    description,
    site,
    items,
    stylesheet: true,
  });
}
