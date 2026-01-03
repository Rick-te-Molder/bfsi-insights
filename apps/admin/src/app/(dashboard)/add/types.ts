/**
 * UI Types for Add Article page
 * KB-274: Page-scoped form state types (MissedDiscovery is in @bfsi/types)
 */

export type SubmissionStatus = 'idle' | 'submitting' | 'uploading' | 'success' | 'error';
export type InputMode = 'url' | 'pdf';

export interface AudienceOption {
  value: string;
  label: string;
  description: string;
}

export interface ChannelOption {
  value: string;
  label: string;
}

export interface UrgencyOption {
  value: string;
  label: string;
  color: string;
}
