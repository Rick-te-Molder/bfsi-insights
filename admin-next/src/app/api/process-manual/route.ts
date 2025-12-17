import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

/**
 * KB-277: Trigger priority processing for manually added articles
 * This endpoint is called immediately after adding an article via the Add Article page
 */
export async function POST(request: NextRequest) {
  try {
    const { queueId } = await request.json();

    if (!queueId) {
      return NextResponse.json({ error: 'queueId is required' }, { status: 400 });
    }

    // Trigger the agent API to process this specific item with priority
    const res = await fetch(`${AGENT_API_URL}/api/agents/process-priority`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify({ queueId }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Failed to trigger priority processing:', error);
      return NextResponse.json({ error: 'Failed to trigger processing' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Processing started' });
  } catch (error) {
    console.error('Process manual error:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
