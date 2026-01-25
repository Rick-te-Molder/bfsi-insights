import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3000';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ queueId: string }> },
) {
  const { queueId } = await params;

  try {
    const response = await fetch(`${AGENT_API_URL}/api/raw-content/by-queue/${queueId}`, {
      headers: {
        'X-API-Key': AGENT_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch signed URL' }, { status: 500 });
  }
}
