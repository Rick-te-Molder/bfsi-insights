import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import { PublicationActions } from './publication-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Publication {
  id: string;
  slug: string;
  title: string;
  source_url: string;
  source_slug: string;
  published_at: string;
  created_at: string;
}

async function getPublications(search?: string) {
  const supabase = createServiceRoleClient();

  let query = supabase
    .from('kb_publication')
    .select('id, slug, title, source_url, source_slug, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching publications:', error);
    return [];
  }

  return data as Publication[];
}

export default async function PublishedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const publications = await getPublications(params.search);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Published Articles</h1>
        <p className="mt-1 text-sm text-neutral-400">{publications.length} published articles</p>
      </header>

      {/* Search */}
      <form className="max-w-md">
        <input
          type="text"
          name="search"
          placeholder="Search publications..."
          defaultValue={params.search}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
        />
      </form>

      {/* Publications List */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
        {publications.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-400">No publications found</p>
          </div>
        ) : (
          publications.map((pub) => (
            <div key={pub.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{pub.title}</p>
                  <a
                    href={pub.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-400 hover:text-sky-300 truncate block mt-1"
                  >
                    {pub.source_url}
                  </a>
                  <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                    <span>Source: {pub.source_slug}</span>
                    <span>Published: {formatDateTime(pub.published_at)}</span>
                    <span>Added: {formatDateTime(pub.created_at)}</span>
                  </div>
                </div>
                <PublicationActions publicationId={pub.id} title={pub.title} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
