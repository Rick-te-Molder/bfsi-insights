import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('requireApiKey middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    vi.resetModules();
    mockReq = {
      path: '/api/agents/run/filter',
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('in production mode', () => {
    beforeEach(() => {
      vi.stubEnv('AGENT_API_KEY', 'test-secret-key');
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('should skip auth for /health endpoint', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.path = '/health';

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow request with valid X-API-Key header', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.headers['x-api-key'] = 'test-secret-key';

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow request with valid Bearer token', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.headers['authorization'] = 'Bearer test-secret-key';

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should prefer X-API-Key over Authorization header', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.headers['x-api-key'] = 'test-secret-key';
      mockReq.headers['authorization'] = 'Bearer wrong-key';

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request with invalid API key', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.headers['x-api-key'] = 'wrong-key';

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Invalid or missing API key',
      });
    });

    it('should reject request with missing API key', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should accept Authorization header without Bearer prefix if key matches', async () => {
      const { requireApiKey } = await import('../../src/middleware/auth.js');
      mockReq.headers['authorization'] = 'test-secret-key';

      requireApiKey(mockReq, mockRes, mockNext);

      // .replace('Bearer ', '') returns original string if no match, so key is accepted
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('in development mode', () => {
    it('should skip auth when no AGENT_API_KEY is set', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      // Don't set AGENT_API_KEY

      const { requireApiKey } = await import('../../src/middleware/auth.js');

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should still require auth if AGENT_API_KEY is set', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('AGENT_API_KEY', 'dev-key');

      const { requireApiKey } = await import('../../src/middleware/auth.js');

      requireApiKey(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
