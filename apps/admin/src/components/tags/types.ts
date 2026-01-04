/**
 * Shared types for dynamic taxonomy display
 * Re-exported from @bfsi/types for convenience
 */

export type {
  TaxonomyItem,
  TaxonomyConfig,
  TaxonomyData,
  TagPayload,
  ValidationLookups,
} from '@bfsi/types';

import type { TaxonomyConfig, TaxonomyData, TagPayload, ValidationLookups } from '@bfsi/types';

/** Common color scheme for tags */
export interface TagColors {
  bg: string;
  text: string;
}

/** Audience info returned by getTopAudiences */
export interface AudienceInfo {
  slug: string;
  name: string;
  score: number;
}

/** Props for row components that display a single config */
export interface ConfigRowProps {
  config: TaxonomyConfig;
  payload: TagPayload;
  labelWidth: string;
  colors: TagColors;
}

/** Props for row components with validation support */
export interface ConfigRowWithValidationProps extends ConfigRowProps {
  validationLookups?: ValidationLookups;
  showValidation: boolean;
}

/** Props for row components that need taxonomy data */
export interface ConfigRowWithDataProps extends ConfigRowProps {
  taxonomyData: TaxonomyData;
}

/** Props for audience label function */
export type GetAudienceLabelFn = (config: TaxonomyConfig) => string;

/** Props for top audiences function */
export type GetTopAudiencesFn = (maxCount?: number) => AudienceInfo[];
