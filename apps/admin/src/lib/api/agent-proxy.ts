/**
 * Shared utility for proxying requests to agent API
 * Eliminates duplication between discovery routes
 */

import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3000';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

/**
 * Proxy a POST request to the agent API
 * @param request - Next.js request object
 * @param endpoint - Agent API endpoint path (e.g., '/api/discovery/run')
 * @param errorContext - Context for error messages (e.g., 'Discovery run')
 */
export async function proxyToAgentAPI(
  request: NextRequest,
  endpoint: string,
  errorContext: string,
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const res = await fetch(`${AGENT_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json();
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`${errorContext} error:`, error);
    return NextResponse.json({ error: `Failed to ${errorContext.toLowerCase()}` }, { status: 500 });
  }
}
