import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Agent API URL (same one used for processing)
const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentName, promptText, testInput } = body;

    if (!agentName || !promptText || !testInput) {
      return NextResponse.json(
        { error: 'Missing required fields: agentName, promptText, testInput' },
        { status: 400 },
      );
    }

    // Call the agent API's test endpoint
    const response = await fetch(`${AGENT_API_URL}/api/test-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: agentName,
        prompt_text: promptText,
        test_input: testInput,
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
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Test prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
