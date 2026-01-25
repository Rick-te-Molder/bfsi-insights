import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

interface HeadToHeadRequest {
  agentName: string;
  versionAId: string;
  versionBId: string;
  itemId: string;
  useLLMJudge?: boolean;
}

function validateRequest(body: Partial<HeadToHeadRequest>): string | null {
  const { agentName, versionAId, versionBId, itemId } = body;
  if (!agentName || !versionAId || !versionBId || !itemId) {
    return 'Missing required fields: agentName, versionAId, versionBId, itemId';
  }
  return null;
}

async function callAgentApi(body: HeadToHeadRequest): Promise<Response> {
  return fetch(`${AGENT_API_URL}/api/evals/head-to-head`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': AGENT_API_KEY },
    body: JSON.stringify({
      agent_name: body.agentName,
      version_a_id: body.versionAId,
      version_b_id: body.versionBId,
      item_id: body.itemId,
      use_llm_judge: body.useLLMJudge || false,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const response = await callAgentApi(body);
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Agent API error: ${errorText}` },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Head-to-head eval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
