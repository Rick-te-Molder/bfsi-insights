import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
) {
  try {
    const { agent } = await params;

    const res = await fetch(`${AGENT_API_URL}/api/jobs/${agent}/jobs`, {
      headers: {
        'X-API-Key': AGENT_API_KEY,
      },
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (res.ok) {
      return NextResponse.json((data ?? {}) as unknown, { status: res.status });
    }

    return NextResponse.json(
      {
        error: 'Agent API request failed',
        agent,
        status: res.status,
        statusText: res.statusText,
        url: `${AGENT_API_URL}/api/jobs/${agent}/jobs`,
        response: data ?? text,
      },
      { status: res.status },
    );
  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json({ error: 'Failed to get jobs' }, { status: 500 });
  }
}
