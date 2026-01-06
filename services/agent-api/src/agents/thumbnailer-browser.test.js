// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() =>
      Promise.resolve({
        newContext: vi.fn(() =>
          Promise.resolve({
            newPage: vi.fn(),
            close: vi.fn(),
          }),
        ),
        close: vi.fn(),
      }),
    ),
  },
}));

import {
  validateUrlScheme,
  launchBrowser,
  createBrowserContext,
  loadAndPreparePage,
  captureScreenshot,
  uploadScreenshot,
} from './thumbnailer-browser.js';

describe('thumbnailer-browser', () => {
  const mockStepTracker = {
    start: vi.fn(() => Promise.resolve('step-1')),
    success: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('validateUrlScheme', () => {
    it('accepts http:// URLs', () => {
      expect(() => validateUrlScheme('http://example.com')).not.toThrow();
    });

    it('accepts https:// URLs', () => {
      expect(() => validateUrlScheme('https://example.com')).not.toThrow();
    });

    it('accepts uppercase HTTP', () => {
      expect(() => validateUrlScheme('HTTPS://example.com')).not.toThrow();
    });

    it('rejects ftp:// URLs', () => {
      expect(() => validateUrlScheme('ftp://example.com')).toThrow('Invalid URL scheme');
    });

    it('rejects file:// URLs', () => {
      expect(() => validateUrlScheme('file:///etc/passwd')).toThrow('Invalid URL scheme');
    });

    it('rejects URLs without scheme', () => {
      expect(() => validateUrlScheme('example.com')).toThrow('Invalid URL scheme');
    });

    it('rejects javascript: URLs', () => {
      expect(() => validateUrlScheme('javascript:alert(1)')).toThrow('Invalid URL scheme');
    });
  });

  describe('launchBrowser', () => {
    it('launches browser and tracks step', async () => {
      const browser = await launchBrowser('https://example.com', mockStepTracker);

      expect(browser).toBeDefined();
      expect(mockStepTracker.start).toHaveBeenCalledWith('browser_launch', {
        url: 'https://example.com',
      });
      expect(mockStepTracker.success).toHaveBeenCalledWith('step-1', { status: 'launched' });
    });
  });

  describe('createBrowserContext', () => {
    it('creates context with correct viewport', async () => {
      const mockBrowser = {
        newContext: vi.fn(() => Promise.resolve({ close: vi.fn() })),
      };
      const config = { viewport: { width: 1280, height: 720 } };

      await createBrowserContext(mockBrowser, config);

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 1280, height: 720 },
          deviceScaleFactor: 1,
        }),
      );
    });
  });

  describe('captureScreenshot', () => {
    it('captures screenshot and returns buffer', async () => {
      const mockPage = {
        screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
      };

      const result = await captureScreenshot(mockPage, mockStepTracker);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockStepTracker.start).toHaveBeenCalledWith('screenshot', { quality: 80 });
      expect(mockStepTracker.success).toHaveBeenCalled();
    });

    it('tracks error on screenshot failure', async () => {
      const mockPage = {
        screenshot: vi.fn(() => Promise.reject(new Error('Screenshot failed'))),
      };

      await expect(captureScreenshot(mockPage, mockStepTracker)).rejects.toThrow(
        'Screenshot failed',
      );
      expect(mockStepTracker.error).toHaveBeenCalledWith('step-1', 'Screenshot failed');
    });
  });

  describe('uploadScreenshot', () => {
    it('uploads screenshot to storage', async () => {
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

      const result = await uploadScreenshot(
        Buffer.from('image'),
        'queue-123',
        mockSupabase,
        mockStepTracker,
      );

      expect(result.path).toBe('thumbnails/queue-123.jpg');
      expect(result.publicUrl).toBe('https://storage.example.com/thumb.jpg');
      expect(mockStepTracker.success).toHaveBeenCalled();
    });

    it('throws on upload error', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ error: { message: 'Storage error' } })),
          })),
        },
      };

      await expect(
        uploadScreenshot(Buffer.from('image'), 'queue-123', mockSupabase, mockStepTracker),
      ).rejects.toThrow('Storage error');
      expect(mockStepTracker.error).toHaveBeenCalled();
    });
  });

  describe('loadAndPreparePage', () => {
    it('loads page and prepares for screenshot', async () => {
      const mockPage = {
        goto: vi.fn(() => Promise.resolve()),
        evaluate: vi.fn(() => Promise.resolve()),
        addStyleTag: vi.fn(() => Promise.resolve()),
      };
      const config = { timeout: 30000, wait: 1000, viewport: { width: 1280, height: 720 } };

      await loadAndPreparePage(mockPage, 'https://example.com', config, mockStepTracker);

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ timeout: 30000 }),
      );
      expect(mockPage.addStyleTag).toHaveBeenCalled();
      expect(mockStepTracker.start).toHaveBeenCalledWith('page_load', {
        url: 'https://example.com',
      });
    });
  });
});
