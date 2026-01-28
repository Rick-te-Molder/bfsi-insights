import { handleEntityAction } from '@/lib/api/entity-actions';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleEntityAction(request, params, 'approve_proposed_entity', 'approve');
}
