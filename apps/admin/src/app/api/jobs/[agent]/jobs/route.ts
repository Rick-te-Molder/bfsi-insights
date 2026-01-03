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

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json({ error: 'Failed to get jobs' }, { status: 500 });
  }
}
