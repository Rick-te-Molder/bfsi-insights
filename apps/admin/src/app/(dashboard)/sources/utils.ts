import type { Source } from '@/types/database';
import type { SourceHealth } from './types';

export function getDiscoveryInfo(source: Source) {
  const methods = [];
  if (source.rss_feed) methods.push({ icon: '📡', label: 'RSS Feed', url: source.rss_feed });
  if (source.sitemap_url) methods.push({ icon: '🗺️', label: 'Sitemap', url: source.sitemap_url });
  if (source.scraper_config) methods.push({ icon: '🤖', label: 'Scraper', url: null });
  return methods;
}

export function getHealthBadge(health: SourceHealth | undefined) {
  if (!health) {
    return { icon: '⚪', label: 'No data', className: 'text-neutral-500' };
  }
  switch (health.health_status) {
    case 'healthy':
      return { icon: '🟢', label: 'Healthy', className: 'text-emerald-400' };
    case 'warning':
      return { icon: '🟡', label: 'Warning', className: 'text-amber-400' };
    case 'error':
      return { icon: '🔴', label: 'Errors', className: 'text-red-400' };
    case 'inactive':
      return { icon: '⚪', label: 'Inactive', className: 'text-neutral-500' };
    default:
      return { icon: '⚪', label: 'Unknown', className: 'text-neutral-500' };
  }
}

export function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    regulator: 'bg-red-500/20 text-red-300',
    central_bank: 'bg-amber-500/20 text-amber-300',
    vendor: 'bg-orange-500/20 text-orange-300',
    research: 'bg-pink-500/20 text-pink-300',
    consulting: 'bg-teal-500/20 text-teal-300',
    media_outlet: 'bg-sky-500/20 text-sky-300',
    standards_body: 'bg-purple-500/20 text-purple-300',
    academic: 'bg-indigo-500/20 text-indigo-300',
    government_body: 'bg-slate-500/20 text-slate-300',
  };
  return colors[category] || 'bg-neutral-700 text-neutral-300';
}

export function createFormatTimeAgo(now: number) {
  return (date: string | null): string => {
    if (!date) return 'Never';
    const diff = now - new Date(date).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };
}

export function calculateStats(sources: Source[]) {
  return {
    total: sources.length,
    enabled: sources.filter((s) => s.enabled).length,
    premium: sources.filter((s) => s.tier === 'premium').length,
    withRss: sources.filter((s) => s.rss_feed).length,
    withScraper: sources.filter((s) => s.scraper_config).length,
  };
}
