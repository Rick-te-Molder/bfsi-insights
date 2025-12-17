import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

// KB-285: Trigger a single enrichment step for immediate processing
export async function POST(request: NextRequest) {
  try {
    const { step, id } = await request.json();

    if (!step || !id) {
      return NextResponse.json({ error: 'step and id are required' }, { status: 400 });
    }

    // Map step to agent API endpoint
    const stepToEndpoint: Record<string, string> = {
      summarize: '/api/agents/run/summarize',
      tag: '/api/agents/run/tag',
      thumbnail: '/api/agents/run/thumbnail',
    };

    const endpoint = stepToEndpoint[step];
    if (!endpoint) {
      return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }

    const res = await fetch(`${AGENT_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Enrich step error:', error);
    return NextResponse.json({ error: 'Failed to run enrichment step' }, { status: 500 });
  }
}
