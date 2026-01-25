// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve(Buffer.from('fake-image'))),
}));

import { downloadPdf, storePdf, uploadThumbnail, renderPdfFirstPage } from './thumbnailer-pdf.js';

import { spawn } from 'node:child_process';

/** @param {{ code: number; stdout: string; stderr: string }} params */
function mockSpawnWithClose(params) {
  const { code, stdout, stderr } = params;

  /** @type {any} */
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  setTimeout(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', code);
  }, 0);

  vi.mocked(spawn).mockReturnValue(proc);
}

/** @param {{ ok: boolean; status?: number; statusText?: string; arrayBuffer?: () => Promise<ArrayBuffer> }} init */
function makeFetchResponse(init) {
  /** @type {any} */
  const res = {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText,
    arrayBuffer: init.arrayBuffer,
  };
  return res;
}

describe('thumbnailer-pdf', () => {
  const mockStepTracker = {
    start: vi.fn(() => Promise.resolve('step-1')),
    success: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    globalThis.fetch = vi.fn();
  });

  describe('downloadPdf', () => {
    it('downloads PDF and returns buffer', async () => {
      const pdfContent = Buffer.from('PDF content');
      const ab = pdfContent.buffer.slice(
        pdfContent.byteOffset,
        pdfContent.byteOffset + pdfContent.byteLength,
      );
      vi.mocked(globalThis.fetch).mockResolvedValue(
        makeFetchResponse({
          ok: true,
          arrayBuffer: () => Promise.resolve(ab),
        }),
      );

      const result = await downloadPdf('https://example.com/doc.pdf', mockStepTracker);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockStepTracker.start).toHaveBeenCalledWith('pdf_download', {
        url: 'https://example.com/doc.pdf',
      });
      expect(mockStepTracker.success).toHaveBeenCalled();
    });

    it('throws on HTTP error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        makeFetchResponse({ ok: false, status: 404, statusText: 'Not Found' }),
      );

      await expect(downloadPdf('https://example.com/missing.pdf', mockStepTracker)).rejects.toThrow(
        'HTTP 404',
      );
      expect(mockStepTracker.error).toHaveBeenCalled();
    });

    it('tracks step on error', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

      await expect(downloadPdf('https://example.com/doc.pdf', mockStepTracker)).rejects.toThrow(
        'Network error',
      );
      expect(mockStepTracker.error).toHaveBeenCalledWith('step-1', 'Network error');
    });
  });

  describe('storePdf', () => {
    it('uploads PDF to storage and returns path', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ error: null })),
            getPublicUrl: vi.fn(() => ({
              data: { publicUrl: 'https://storage.example.com/pdf.pdf' },
            })),
          })),
        },
      };

      const result = await storePdf(Buffer.from('pdf'), 'queue-123', mockSupabase, mockStepTracker);

      expect(result.pdfPath).toBe('pdfs/queue-123.pdf');
      expect(result.publicUrl).toBe('https://storage.example.com/pdf.pdf');
      expect(mockStepTracker.success).toHaveBeenCalled();
    });

    it('throws on upload error', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ error: { message: 'Upload failed' } })),
          })),
        },
      };

      await expect(
        storePdf(Buffer.from('pdf'), 'queue-123', mockSupabase, mockStepTracker),
      ).rejects.toThrow('Upload failed');
      expect(mockStepTracker.error).toHaveBeenCalled();
    });
  });

  describe('uploadThumbnail', () => {
    it('uploads thumbnail to storage and returns path', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ error: null })),
            getPublicUrl: vi.fn(() => ({
              data: { publicUrl: 'https://storage.example.com/thumb.jpg' },
            })),
          })),
        },
      };

      const result = await uploadThumbnail(
        Buffer.from('image'),
        'queue-123',
        mockSupabase,
        mockStepTracker,
      );

      expect(result.thumbnailPath).toBe('thumbnails/queue-123.jpg');
      expect(result.publicUrl).toBe('https://storage.example.com/thumb.jpg');
      expect(mockStepTracker.success).toHaveBeenCalled();
    });

    it('throws on upload error', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ error: { message: 'Thumbnail upload failed' } })),
          })),
        },
      };

      await expect(
        uploadThumbnail(Buffer.from('image'), 'queue-123', mockSupabase, mockStepTracker),
      ).rejects.toThrow('Thumbnail upload failed');
      expect(mockStepTracker.error).toHaveBeenCalled();
    });
  });

  describe('renderPdfFirstPage', () => {
    it('renders first page and returns screenshot buffer', async () => {
      mockSpawnWithClose({
        code: 0,
        stdout: JSON.stringify({ success: true }),
        stderr: '',
      });

      const config = { viewport: { width: 100, height: 100 } };
      const res = await renderPdfFirstPage(Buffer.from('pdf'), 'q1', config, '/script.py');

      expect(res.screenshotBuffer).toBeInstanceOf(Buffer);
      expect(res.result).toEqual({ success: true });
    });

    it('throws when python exits non-zero', async () => {
      mockSpawnWithClose({ code: 1, stdout: '', stderr: 'bad' });

      const config = { viewport: { width: 100, height: 100 } };
      await expect(
        renderPdfFirstPage(Buffer.from('pdf'), 'q1', config, '/script.py'),
      ).rejects.toThrow('PDF rendering failed');
    });
  });
});
