import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (!AGENT_API_KEY) {
      return NextResponse.json({ error: 'AGENT_API_KEY not configured' }, { status: 500 });
    }

    // Call agent API to process this specific item
    const res = await fetch(`${AGENT_API_URL}/api/agents/enrich-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify({ id }),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      // Agent API returned non-JSON (e.g., HTML error page)
      const preview = text.substring(0, 100).replaceAll(/\s+/g, ' ');
      return NextResponse.json(
        { error: `Agent API unavailable: ${preview}...` },
        { status: 503 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Agent API error' },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Enrich item error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
