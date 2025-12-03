import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

interface Source {
  slug: string;
  name: string;
  domain: string;
  tier: string;
  category: string;
  description: string | null;
  rss_feed: string | null;
  sitemap_url: string | null;
  scraper_config: unknown;
  enabled: boolean;
  sort_order: number;
  show_on_external_page: boolean;
}

let sources: Source[] = [];

// DOM Elements
const loading = document.getElementById('loading');
const errorEl = document.getElementById('error');
const sourcesTable = document.getElementById('sources-table');
const sourcesBody = document.getElementById('sources-body');
const statsEl = document.getElementById('stats');
const modal = document.getElementById('source-modal');
const modalTitle = document.getElementById('modal-title');
const form = document.getElementById('source-form') as HTMLFormElement;
const filterCategory = document.getElementById('filter-category') as HTMLSelectElement;
const filterTier = document.getElementById('filter-tier') as HTMLSelectElement;
const filterEnabled = document.getElementById('filter-enabled') as HTMLSelectElement;

export async function checkAuth(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    globalThis.location.href = '/admin/login';
    return false;
  }
  return true;
}

export async function loadSources(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('kb_source')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    sources = data || [];
    renderSources();
    renderStats();
  } catch (err: unknown) {
    showError((err as Error).message);
  }
}

function renderStats(): void {
  const total = sources.length;
  const enabled = sources.filter((s) => s.enabled).length;
  const premium = sources.filter((s) => s.tier === 'premium').length;
  const withRss = sources.filter((s) => s.rss_feed).length;

  statsEl!.innerHTML = `
    <span class="rounded-full bg-neutral-800 px-3 py-1">${total} total</span>
    <span class="rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-1">${enabled} enabled</span>
    <span class="rounded-full bg-amber-500/20 text-amber-300 px-3 py-1">${premium} premium</span>
    <span class="rounded-full bg-sky-500/20 text-sky-300 px-3 py-1">${withRss} with RSS</span>
  `;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'financial-media': 'bg-blue-500/20 text-blue-300',
    'ai-thought-leader': 'bg-purple-500/20 text-purple-300',
    'strategy-consulting': 'bg-emerald-500/20 text-emerald-300',
    big4: 'bg-emerald-500/20 text-emerald-300',
    consulting: 'bg-teal-500/20 text-teal-300',
    vendor: 'bg-orange-500/20 text-orange-300',
    research: 'bg-pink-500/20 text-pink-300',
    regulator: 'bg-red-500/20 text-red-300',
    publication: 'bg-sky-500/20 text-sky-300',
  };
  return colors[category] || 'bg-neutral-700 text-neutral-300';
}

function getFeedIcon(source: Source): string {
  if (source.rss_feed) return '📡';
  if (source.sitemap_url) return '🗺️';
  if (source.scraper_config) return '🤖';
  return '❌';
}

export function renderSources(): void {
  loading!.classList.add('hidden');
  sourcesTable!.classList.remove('hidden');

  let filtered = [...sources];

  if (filterCategory.value) {
    filtered = filtered.filter((s) => s.category === filterCategory.value);
  }
  if (filterTier.value) {
    filtered = filtered.filter((s) => s.tier === filterTier.value);
  }
  if (filterEnabled.value) {
    filtered = filtered.filter((s) => String(s.enabled) === filterEnabled.value);
  }

  sourcesBody!.innerHTML = filtered
    .map(
      (source) => `
    <tr class="hover:bg-neutral-800/50">
      <td class="py-3 pr-4">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-700 text-xs font-medium">
          ${source.sort_order ? Math.ceil(source.sort_order / 100) : '-'}
        </span>
      </td>
      <td class="py-3 pr-4">
        <div class="font-medium text-white">${source.name}</div>
        <div class="text-xs text-neutral-500">${source.domain}</div>
      </td>
      <td class="py-3 pr-4">
        <span class="rounded-full px-2 py-0.5 text-xs ${getCategoryColor(source.category)}">
          ${source.category || '-'}
        </span>
      </td>
      <td class="py-3 pr-4">
        <span class="text-xs ${source.tier === 'premium' ? 'text-amber-400' : 'text-neutral-400'}">
          ${source.tier}
        </span>
      </td>
      <td class="py-3 pr-4">
        ${getFeedIcon(source)}
      </td>
      <td class="py-3 pr-4">
        <button
          class="toggle-enabled w-10 h-5 rounded-full transition-colors ${source.enabled ? 'bg-emerald-500' : 'bg-neutral-700'}"
          data-slug="${source.slug}"
          data-enabled="${source.enabled}"
        >
          <span class="block w-4 h-4 rounded-full bg-white transform transition-transform ${source.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
        </button>
      </td>
      <td class="py-3">
        <button class="edit-btn text-sky-400 hover:text-sky-300 text-sm mr-3" data-slug="${source.slug}">
          Edit
        </button>
        <button class="delete-btn text-red-400 hover:text-red-300 text-sm" data-slug="${source.slug}" data-name="${source.name}">
          Delete
        </button>
      </td>
    </tr>
  `,
    )
    .join('');

  // Bind handlers
  document.querySelectorAll('.toggle-enabled').forEach((btn) => {
    btn.addEventListener('click', handleToggleEnabled);
  });
  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', handleEdit);
  });
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', handleDelete);
  });
}

async function handleToggleEnabled(e: Event): Promise<void> {
  const btn = e.currentTarget as HTMLButtonElement;
  const slug = btn.dataset.slug;
  const currentEnabled = btn.dataset.enabled === 'true';

  const { error } = await supabase
    .from('kb_source')
    .update({ enabled: !currentEnabled })
    .eq('slug', slug);

  if (error) {
    alert('Failed to update: ' + error.message);
  } else {
    loadSources();
  }
}

function handleEdit(e: Event): void {
  const btn = e.currentTarget as HTMLButtonElement;
  const slug = btn.dataset.slug;
  const source = sources.find((s) => s.slug === slug);
  if (!source) return;

  modalTitle!.textContent = 'Edit Source';
  (document.getElementById('edit-slug') as HTMLInputElement).value = source.slug;
  (document.getElementById('source-name') as HTMLInputElement).value = source.name;
  (document.getElementById('source-slug') as HTMLInputElement).value = source.slug;
  (document.getElementById('source-slug') as HTMLInputElement).disabled = true;
  (document.getElementById('source-domain') as HTMLInputElement).value = source.domain || '';
  (document.getElementById('source-priority') as HTMLSelectElement).value = String(
    Math.ceil((source.sort_order || 100) / 100),
  );
  (document.getElementById('source-category') as HTMLSelectElement).value =
    source.category || 'publication';
  (document.getElementById('source-tier') as HTMLSelectElement).value = source.tier || 'standard';
  (document.getElementById('source-description') as HTMLTextAreaElement).value =
    source.description || '';
  (document.getElementById('source-rss') as HTMLInputElement).value = source.rss_feed || '';
  (document.getElementById('source-sitemap') as HTMLInputElement).value = source.sitemap_url || '';
  (document.getElementById('source-enabled') as HTMLInputElement).checked = source.enabled;
  (document.getElementById('source-show-external') as HTMLInputElement).checked =
    source.show_on_external_page;

  openModal();
}

async function handleDelete(e: Event): Promise<void> {
  const btn = e.currentTarget as HTMLButtonElement;
  const slug = btn.dataset.slug;
  const name = btn.dataset.name;

  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const { error } = await supabase.from('kb_source').delete().eq('slug', slug);

  if (error) {
    alert('Failed to delete: ' + error.message);
  } else {
    loadSources();
  }
}

export function openModal(): void {
  modal!.classList.remove('hidden');
  modal!.classList.add('flex');
}

export function closeModal(): void {
  modal!.classList.add('hidden');
  modal!.classList.remove('flex');
}

export function openAddModal(): void {
  modalTitle!.textContent = 'Add Source';
  form.reset();
  (document.getElementById('edit-slug') as HTMLInputElement).value = '';
  (document.getElementById('source-slug') as HTMLInputElement).disabled = false;
  (document.getElementById('source-enabled') as HTMLInputElement).checked = true;
  openModal();
}

export async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const editSlug = (document.getElementById('edit-slug') as HTMLInputElement).value;
  const priority = Number.parseInt(
    (document.getElementById('source-priority') as HTMLSelectElement).value,
    10,
  );

  const sourceData = {
    name: (document.getElementById('source-name') as HTMLInputElement).value,
    slug: (document.getElementById('source-slug') as HTMLInputElement).value,
    domain: (document.getElementById('source-domain') as HTMLInputElement).value,
    sort_order: priority * 100,
    category: (document.getElementById('source-category') as HTMLSelectElement).value,
    tier: (document.getElementById('source-tier') as HTMLSelectElement).value,
    description:
      (document.getElementById('source-description') as HTMLTextAreaElement).value || null,
    rss_feed: (document.getElementById('source-rss') as HTMLInputElement).value || null,
    sitemap_url: (document.getElementById('source-sitemap') as HTMLInputElement).value || null,
    enabled: (document.getElementById('source-enabled') as HTMLInputElement).checked,
    show_on_external_page: (document.getElementById('source-show-external') as HTMLInputElement)
      .checked,
  };

  let error;
  if (editSlug) {
    console.log('Updating source:', editSlug, sourceData);
    const { error: updateError, data } = await supabase
      .from('kb_source')
      .update(sourceData)
      .eq('slug', editSlug)
      .select();
    console.log('Update result:', { error: updateError, data });
    error = updateError;
  } else {
    const { error: insertError } = await supabase.from('kb_source').insert(sourceData);
    error = insertError;
  }

  if (error) {
    alert('Failed to save: ' + error.message);
  } else {
    closeModal();
    loadSources();
  }
}

function showError(message: string): void {
  loading!.classList.add('hidden');
  errorEl!.classList.remove('hidden');
  errorEl!.querySelector('p')!.textContent = message;
}

export function initFilters(): void {
  filterCategory?.addEventListener('change', renderSources);
  filterTier?.addEventListener('change', renderSources);
  filterEnabled?.addEventListener('change', renderSources);
}

export function initModalHandlers(): void {
  document.getElementById('add-source-btn')?.addEventListener('click', openAddModal);
  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-btn')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  form?.addEventListener('submit', handleFormSubmit);
}
