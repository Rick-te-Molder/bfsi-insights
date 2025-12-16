import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
) {
  try {
    const { agent } = await params;
    const body = await request.json();

    const res = await fetch(`${AGENT_API_URL}/api/jobs/${agent}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Job start error:', error);
    return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
  }
}
