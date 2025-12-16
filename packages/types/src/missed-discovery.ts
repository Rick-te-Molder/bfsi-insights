/**
 * Missed Discovery types
 * KB-274: Shared type for missed_discovery table
 */

export interface MissedDiscovery {
  id: string;
  url: string;
  source_domain: string;
  submitter_name: string | null;
  submitter_audience: string | null;
  submitter_channel: string | null;
  why_valuable: string | null;
  submitter_urgency: string | null;
  resolution_status: string;
  submitted_at: string;
  existing_source_slug: string | null;
}
