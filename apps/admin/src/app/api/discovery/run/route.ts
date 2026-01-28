import { proxyToAgentAPI } from '@/lib/api/agent-proxy';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return proxyToAgentAPI(request, '/api/discovery/run', 'Discovery run');
}
