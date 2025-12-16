import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3000';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${AGENT_API_URL}/api/discovery/run`, {
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
    console.error('Discovery run error:', error);
    return NextResponse.json({ error: 'Failed to run discovery' }, { status: 500 });
  }
}
