import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

function validateRequest(body: any) {
  if (!body.promptVersionId) {
    return NextResponse.json({ error: 'Missing promptVersionId' }, { status: 400 });
  }
  return null;
}

async function callAgentAPI(promptVersionId: string, criteria?: string) {
  return fetch(`${AGENT_API_URL}/api/evals/llm-judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt_version_id: promptVersionId,
      criteria: criteria || 'quality, accuracy, and completeness',
    }),
  });
}

async function handleAPIResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Agent API error: ${errorText}` },
      { status: response.status },
    );
  }
  const result = await response.json();
  return NextResponse.json(result);
}

function handleError(error: unknown) {
  console.error('LLM Judge eval error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationError = validateRequest(body);
    if (validationError) return validationError;

    const { promptVersionId, criteria } = body;
    const response = await callAgentAPI(promptVersionId, criteria);
    return handleAPIResponse(response);
  } catch (error) {
    return handleError(error);
  }
}
