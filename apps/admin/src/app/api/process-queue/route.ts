import { NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';
const AGENT_API_KEY = process.env.AGENT_API_KEY;

function parseAgentResponse(text: string): {
  data: Record<string, unknown> | null;
  error: string | null;
} {
  try {
    return { data: JSON.parse(text), error: null };
  } catch {
    const preview = text.substring(0, 100).replaceAll(/\s+/g, ' ');
    return { data: null, error: `Agent API unavailable: ${preview}...` };
  }
}

async function callProcessQueue(): Promise<Response> {
  return fetch(`${AGENT_API_URL}/api/agents/process-queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': AGENT_API_KEY! },
    body: JSON.stringify({ limit: 20, includeThumbnail: true }),
  });
}

export async function POST() {
  if (!AGENT_API_KEY) {
    return NextResponse.json({ error: 'AGENT_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await callProcessQueue();
    const text = await res.text();
    const { data, error: parseError } = parseAgentResponse(text);

    if (parseError || !data) {
      return NextResponse.json({ error: parseError }, { status: 503 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Agent API error' }, { status: res.status });
    }

    return NextResponse.json({
      processed: data.processed || (data.results as unknown[])?.length || 0,
      results: data.results,
    });
  } catch (error) {
    console.error('Process queue error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
