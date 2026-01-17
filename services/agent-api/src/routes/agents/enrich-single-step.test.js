import { describe, it, expect } from 'vitest';

import { buildThumbnailPayload } from './enrich-single-step.js';
import { getUtilityVersion } from '../../lib/utility-versions.js';

describe('routes/agents/enrich-single-step', () => {
  describe('buildThumbnailPayload', () => {
    it('persists enrichment_meta.thumbnail implementation_version for utility version checks', () => {
      const basePayload = {
        enrichment_meta: {
          thumbnail: {
            agent_type: 'utility',
            implementation_version: '0.0',
            method: 'playwright',
            processed_at: '2020-01-01T00:00:00.000Z',
          },
        },
      };

      const result = {
        bucket: 'asset',
        path: 'thumbs/abc.png',
        publicUrl: 'https://example.com/thumbs/abc.png',
      };

      const payload = buildThumbnailPayload(basePayload, result);

      expect(payload.thumbnail_bucket).toBe('asset');
      expect(payload.thumbnail_path).toBe('thumbs/abc.png');
      expect(payload.thumbnail_url).toBe('https://example.com/thumbs/abc.png');

      expect(payload.enrichment_meta).toBeTruthy();
      expect(payload.enrichment_meta.thumbnail).toBeTruthy();
      expect(payload.enrichment_meta.thumbnail.agent_type).toBe('utility');
      expect(payload.enrichment_meta.thumbnail.implementation_version).toBe(
        getUtilityVersion('thumbnail-generator'),
      );
    });
  });
});
