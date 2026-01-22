import { describe, expect, it, vi } from 'vitest';

vi.mock('../../agents/summarizer.js', () => ({ runSummarizer: vi.fn() }));
vi.mock('../../agents/tagger.js', () => ({ runTagger: vi.fn() }));
vi.mock('../../agents/thumbnailer.js', () => ({ runThumbnailer: vi.fn() }));
vi.mock('../../lib/utility-versions.js', () => ({ getUtilityVersion: vi.fn(() => '1.2.3') }));

import {
  buildThumbnailPayload,
  cleanupSingleStepFlags,
  getManualOverrideFlag,
  getReturnStatus,
  isStepKey,
  parseEnrichRequestBody,
  validateStepPersisted,
} from './enrich-single-step.logic.js';

describe('routes/agents/enrich-single-step.logic', () => {
  describe('isStepKey', () => {
    it('accepts known step keys', () => {
      expect(isStepKey('summarize')).toBe(true);
      expect(isStepKey('tag')).toBe(true);
      expect(isStepKey('thumbnail')).toBe(true);
    });

    it('rejects unknown values', () => {
      expect(isStepKey('other')).toBe(false);
      expect(isStepKey(null)).toBe(false);
      expect(isStepKey(undefined)).toBe(false);
    });
  });

  describe('parseEnrichRequestBody', () => {
    it('rejects missing id/step', () => {
      expect(parseEnrichRequestBody({})).toEqual({
        ok: false,
        status: 400,
        error: 'id and step are required',
      });
    });

    it('rejects unknown step', () => {
      expect(parseEnrichRequestBody({ id: '1', step: 'nope' })).toEqual({
        ok: false,
        status: 400,
        error: 'Unknown step: nope',
      });
    });

    it('accepts known step', () => {
      expect(parseEnrichRequestBody({ id: '1', step: 'tag' })).toEqual({
        ok: true,
        id: '1',
        step: 'tag',
      });
    });
  });

  describe('buildThumbnailPayload', () => {
    it('sets bucket/path/url and preserves meta structure', () => {
      const basePayload = { enrichment_meta: { existing: true } };
      const result = { bucket: 'b', path: 'p', publicUrl: 'u', pdfPath: null };

      const payload = buildThumbnailPayload(basePayload, result);

      expect(payload.thumbnail_bucket).toBe('b');
      expect(payload.thumbnail_path).toBe('p');
      expect(payload.thumbnail_url).toBe('u');
      expect(payload.enrichment_meta.thumbnail.implementation_version).toBe('1.2.3');
      expect(payload.enrichment_meta.thumbnail.method).toBe('playwright');
    });

    it('uses pdf2image method when pdfPath is present', () => {
      const payload = buildThumbnailPayload(
        {},
        { bucket: 'b', path: 'p', publicUrl: 'u', pdfPath: '/tmp/a.pdf' },
      );
      expect(payload.enrichment_meta.thumbnail.method).toBe('pdf2image');
    });
  });

  describe('validateStepPersisted', () => {
    it('throws for tag step when no tag output persisted', () => {
      expect(() => validateStepPersisted('tag', {})).toThrow(
        'Tag step reported success but no tags/tagging_metadata/enrichment_meta were persisted',
      );
    });

    it('does not throw for tag step when tagging_metadata tagged_at is present', () => {
      expect(() =>
        validateStepPersisted('tag', {
          tagging_metadata: { tagged_at: '2026-01-01T00:00:00.000Z' },
        }),
      ).not.toThrow();
    });

    it('throws for thumbnail step when missing fields', () => {
      expect(() => validateStepPersisted('thumbnail', { thumbnail_url: 'x' })).toThrow(
        'Thumbnail step reported success but thumbnail_url/enrichment_meta.thumbnail.implementation_version were not persisted',
      );
    });

    it('does not throw for thumbnail step when thumbnail_url and meta exist', () => {
      expect(() =>
        validateStepPersisted('thumbnail', {
          thumbnail_url: 'x',
          enrichment_meta: { thumbnail: { implementation_version: '1.0.0' } },
        }),
      ).not.toThrow();
    });
  });

  describe('getReturnStatus/getManualOverrideFlag/cleanupSingleStepFlags', () => {
    it('returnStatus is null during enrichment phase', () => {
      expect(getReturnStatus({ status_code: 200, payload: {} }, { _return_status: 'a' })).toBe(
        null,
      );
    });

    it('returnStatus prefers item payload when not in enrichment phase', () => {
      expect(
        getReturnStatus(
          { status_code: 100, payload: { _return_status: 'x' } },
          { _return_status: 'y' },
        ),
      ).toBe('x');
    });

    it('manualOverride prefers item payload', () => {
      expect(getManualOverrideFlag({ payload: { _manual_override: true } }, {})).toBe(true);
    });

    it('cleanup removes single-step flags and preserves manual override', () => {
      /** @type {any} */
      const payload = { _return_status: 'x', _single_step: true };
      cleanupSingleStepFlags(payload, true);
      expect(payload._return_status).toBeUndefined();
      expect(payload._single_step).toBeUndefined();
      expect(payload._manual_override).toBe(true);
    });
  });
});
