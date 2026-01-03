interface QueueItem {
  id: string;
  url: string;
  payload: {
    title?: string;
    source_name?: string;
  };
  discovered_at: string;
  status_code: number;
}

export function getSource(item: QueueItem): string {
  if (item.payload?.source_name) return item.payload.source_name;
  try {
    const url = new URL(item.url);
    return url.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

export function getItemLabel(item: QueueItem): string {
  const source = getSource(item);
  const title = item.payload?.title || item.url || item.id;
  return `${source} | ${title}`;
}

export function filterItems(
  items: QueueItem[],
  statusFilter: string,
  searchQuery: string,
): QueueItem[] {
  return items.filter((item) => {
    if (statusFilter && item.status_code !== Number(statusFilter)) {
      return false;
    }
    if (searchQuery) {
      const label = getItemLabel(item).toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!label.includes(query)) {
        return false;
      }
    }
    return true;
  });
}
