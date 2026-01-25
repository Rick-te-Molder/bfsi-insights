import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Agent API URL (same one used for processing)
const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

interface TestPromptRequest {
  agentName: string;
  promptText: string;
  testInput: string;
}

function validateTestPromptRequest(body: Partial<TestPromptRequest>): string | null {
  const { agentName, promptText, testInput } = body;
  if (!agentName || !promptText || !testInput) {
    return 'Missing required fields: agentName, promptText, testInput';
  }
  return null;
}

async function callTestPromptApi(body: TestPromptRequest): Promise<Response> {
  return fetch(`${AGENT_API_URL}/api/test-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: body.agentName,
      prompt_text: body.promptText,
      test_input: body.testInput,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationError = validateTestPromptRequest(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const response = await callTestPromptApi(body);
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Agent API error: ${errorText}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ result: await response.json() });
  } catch (error) {
    console.error('Test prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
