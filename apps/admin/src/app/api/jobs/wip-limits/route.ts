import { NextResponse } from 'next/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';

export async function GET() {
  try {
    const res = await fetch(`${AGENT_API_URL}/api/jobs/wip-limits`);
    if (!res.ok) {
      throw new Error(`Failed to fetch WIP limits: ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('WIP limits fetch error:', error);
    // Fallback to defaults if agent-api is unavailable
    return NextResponse.json({
      summarizer: 50,
      tagger: 50,
      thumbnailer: 50,
    });
  }
}
