import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExistingSource } from './types';
import { buildIngestionQueueInsert, buildMissedDiscoveryInsert } from './submitMissedForm.inserts';
import { normalizeUrl } from './submitMissedForm.normalize';
import {
  insertIngestionQueue,
  insertMissedDiscovery,
  isDuplicateMissedDiscovery,
} from './submitMissedForm.queries';

export type MissedFormValues = {
  url: string;
  submitterName: string;
  submitterAudience: string;
  submitterChannel: string;
  submitterUrgency: string;
  whyValuable: string;
  verbatimComment: string;
  suggestedAudiences: string[];
};

export function validateMissedForm(
  values: Pick<MissedFormValues, 'url' | 'whyValuable' | 'submitterAudience'>,
) {
  if (!values.url.trim()) return 'Please enter a URL';
  if (!values.whyValuable.trim()) return 'Please explain why this article was valuable';
  if (!values.submitterAudience) return "Please select the submitter's audience/role";
  return null;
}

export async function submitMissedForm(args: {
  supabase: SupabaseClient;
  existingSource: ExistingSource | null;
  values: MissedFormValues;
}) {
  const { supabase, existingSource, values } = args;

  const { urlNorm, domain } = normalizeUrl(values.url);
  if (await isDuplicateMissedDiscovery(supabase, urlNorm)) {
    return { ok: false as const, message: 'This URL has already been reported as missed' };
  }

  await insertMissedDiscovery(
    supabase,
    buildMissedDiscoveryInsert({ values, existingSource, urlNorm, domain }),
  );

  await insertIngestionQueue(
    supabase,
    buildIngestionQueueInsert({ values, urlNorm, existingSource }),
  );

  return {
    ok: true as const,
    message: 'Article submitted! It will be processed AND help improve our discovery.',
  };
}
