'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function useSupabaseClient() {
  return useMemo(() => createClient(), []);
}

function extractDomain(url: string) {
  const urlObj = new URL(url);
  return urlObj.hostname.replace(/^www\./, '');
}

async function findExistingSource(opts: {
  supabase: ReturnType<typeof createClient>;
  domain: string;
}) {
  const { supabase, domain } = opts;
  return supabase
    .from('kb_source')
    .select('slug, name')
    .ilike('domain', `%${domain}%`)
    .limit(1)
    .then(({ data }) => data?.[0]?.name || data?.[0]?.slug || null);
}

export function useDetectedSource(url: string) {
  const supabase = useSupabaseClient();
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [existingSource, setExistingSource] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setDetectedDomain(null);
      setExistingSource(null);
      return;
    }

    try {
      const domain = extractDomain(url);
      setDetectedDomain(domain);
      findExistingSource({ supabase, domain }).then(setExistingSource);
    } catch {
      setDetectedDomain(null);
      setExistingSource(null);
    }
  }, [supabase, url]);

  return { detectedDomain, existingSource };
}
