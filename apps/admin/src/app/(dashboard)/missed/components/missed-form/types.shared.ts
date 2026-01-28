/**
 * Shared type definitions for missed form components
 * Eliminates duplication between MissedFormSections and MissedFormView
 */

import type { SubmissionStatus } from '../../types';

export type FormModel = {
  status: SubmissionStatus;
  message?: string;
  values: {
    url: string;
    submitterName: string;
    submitterChannel: string;
    submitterAudience: string;
    submitterUrgency: string;
    whyValuable: string;
    verbatimComment: string;
    suggestedAudiences: string[];
  };
  setters: {
    setUrl: (v: string) => void;
    setSubmitterName: (v: string) => void;
    setSubmitterChannel: (v: string) => void;
    setSubmitterAudience: (v: string) => void;
    setSubmitterUrgency: (v: string) => void;
    setWhyValuable: (v: string) => void;
    setVerbatimComment: (v: string) => void;
  };
  toggleAudience: (a: string) => void;
};

export type { ExistingSource } from './types';
