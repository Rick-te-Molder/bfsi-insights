import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentName, versionAId, versionBId, itemId, useLLMJudge } = body;

    if (!agentName || !versionAId || !versionBId || !itemId) {
      return NextResponse.json(
        { error: 'Missing required fields: agentName, versionAId, versionBId, itemId' },
        { status: 400 },
      );
    }

    const response = await fetch(`${AGENT_API_URL}/api/evals/head-to-head`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: agentName,
        version_a_id: versionAId,
        version_b_id: versionBId,
        item_id: itemId,
        use_llm_judge: useLLMJudge || false,
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
    console.error('Head-to-head eval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
