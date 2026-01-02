import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExistingSource } from './types';
import { fetchExistingSource } from './fetchExistingSource';
import { parseDomainFromUrl } from './parseDomain';

export function useUrlSource(url: string, supabase: SupabaseClient) {
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [existingSource, setExistingSource] = useState<ExistingSource | null>(null);

  useEffect(() => {
    if (!url) {
      setDetectedDomain(null);
      setExistingSource(null);
      return;
    }

    const domain = parseDomainFromUrl(url);
    if (!domain) {
      setDetectedDomain(null);
      setExistingSource(null);
      return;
    }

    setDetectedDomain(domain);
    fetchExistingSource(supabase, domain).then(setExistingSource);
  }, [supabase, url]);

  return { detectedDomain, existingSource };
}
