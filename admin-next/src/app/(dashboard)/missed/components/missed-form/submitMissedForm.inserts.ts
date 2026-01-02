import type { ExistingSource } from './types';
import type { MissedFormValues } from './useMissedFormValues';

export function buildMissedDiscoveryInsert(args: {
  values: MissedFormValues;
  existingSource: ExistingSource | null;
  urlNorm: string;
  domain: string;
}) {
  const { values, existingSource, urlNorm, domain } = args;

  return {
    url: values.url.trim(),
    url_norm: urlNorm,
    submitter_name: values.submitterName.trim() || null,
    submitter_type: 'client' as const,
    submitter_audience: values.submitterAudience,
    submitter_channel: values.submitterChannel,
    submitter_urgency: values.submitterUrgency,
    why_valuable: values.whyValuable.trim(),
    verbatim_comment: values.verbatimComment.trim() || null,
    suggested_audiences: values.suggestedAudiences.length > 0 ? values.suggestedAudiences : null,
    source_domain: domain,
    existing_source_slug: existingSource?.slug ?? null,
  };
}

export function buildIngestionQueueInsert(args: {
  values: MissedFormValues;
  urlNorm: string;
  existingSource: ExistingSource | null;
}) {
  const { values, urlNorm, existingSource } = args;

  return {
    url: values.url.trim(),
    url_norm: urlNorm,
    source: existingSource?.slug ?? 'manual',
    status: 'pending' as const,
    status_code: 200,
    payload: {
      manual_add: true as const,
      submitter: values.submitterName.trim() || null,
      why_valuable: values.whyValuable.trim(),
    },
  };
}
