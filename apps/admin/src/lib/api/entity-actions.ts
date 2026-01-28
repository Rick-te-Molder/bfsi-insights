/**
 * Shared utility for entity approval/rejection actions
 * Eliminates duplication between approve and reject routes
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type EntityActionResult = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

/**
 * Generic handler for entity actions (approve/reject)
 * @param request - Next.js request object
 * @param params - Route params containing entity ID
 * @param rpcFunction - Name of the RPC function to call
 * @param actionName - Human-readable action name for error messages
 */
export async function handleEntityAction(
  request: NextRequest,
  params: Promise<{ id: string }>,
  rpcFunction: string,
  actionName: string,
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  let notes: string | undefined;
  try {
    const body = await request.json();
    notes = body.notes;
  } catch {
    // No body is fine
  }

  const { data, error } = await supabase.rpc(rpcFunction, {
    p_proposal_id: id,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json(
      { error: (data as EntityActionResult)?.error || `Failed to ${actionName}` },
      { status: 400 },
    );
  }

  return NextResponse.json(data);
}
