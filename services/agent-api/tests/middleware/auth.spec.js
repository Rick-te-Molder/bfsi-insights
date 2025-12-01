import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock process.env before importing
vi.stubEnv('AGENT_API_KEY', 'test-secret-key');
vi.stubEnv('NODE_ENV', 'production');

const { requireApiKey } = await import('../../src/middleware/auth.js');

describe('requireApiKey middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
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

  it('should skip auth for /health endpoint', () => {
    mockReq.path = '/health';

    requireApiKey(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should allow request with valid X-API-Key header', () => {
    mockReq.headers['x-api-key'] = 'test-secret-key';

    requireApiKey(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should allow request with valid Bearer token', () => {
    mockReq.headers['authorization'] = 'Bearer test-secret-key';

    requireApiKey(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject request with invalid API key', () => {
    mockReq.headers['x-api-key'] = 'wrong-key';

    requireApiKey(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid or missing API key',
    });
  });

  it('should reject request with missing API key', () => {
    requireApiKey(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
