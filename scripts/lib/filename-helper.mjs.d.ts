export function toAscii(s: string | null | undefined): string;

export function slug(s: string | null | undefined): string;

export function lastName(full: string | null | undefined): string;

export type KbFileNameOptions = {
  title?: string | null;
  date_published?: string | null;
  authors?: string[];
  source_name?: string | null;
  source_domain?: string | null;
  version?: string | number | null;
};

export function kbFileName(options: KbFileNameOptions): string;
