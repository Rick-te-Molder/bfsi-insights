import process from 'node:process';

/**
 * API Key authentication middleware
 * Requires AGENT_API_KEY header for all requests except /health
 */
export function requireApiKey(req, res, next) {
  // Skip auth for health checks
  if (req.path === '/health') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedKey = process.env.AGENT_API_KEY;

  // Skip auth in development if no key is set
  if (!expectedKey && process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  next();
}
