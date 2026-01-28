import { handleEntityAction } from '@/lib/api/entity-actions';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleEntityAction(request, params, 'reject_proposed_entity', 'reject');
}
