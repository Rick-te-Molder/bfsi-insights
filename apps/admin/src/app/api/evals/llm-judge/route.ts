import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { promptVersionId, criteria } = body;

    if (!promptVersionId) {
      return NextResponse.json({ error: 'Missing promptVersionId' }, { status: 400 });
    }

    const response = await fetch(`${AGENT_API_URL}/api/evals/llm-judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt_version_id: promptVersionId,
        criteria: criteria || 'quality, accuracy, and completeness',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Agent API error: ${errorText}` },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('LLM Judge eval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
