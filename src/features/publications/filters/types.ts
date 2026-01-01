export type FilterValues = Record<string, string> & { q: string };

export interface IndexedItem {
  el: HTMLElement;
  title: string;
  source_name: string;
  authors: string;
  summary: string;
  tags_text: string;
  [key: string]: string | HTMLElement;
}

export interface FilterElement {
  key: string;
  el: HTMLSelectElement;
}
