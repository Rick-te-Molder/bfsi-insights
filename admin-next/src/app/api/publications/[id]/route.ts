import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Get publication to find source_url for ingestion_queue update
  const { data: publication } = await supabase
    .from('kb_publication')
    .select('source_url')
    .eq('id', id)
    .single();

  // Delete from kb_publication
  const { error } = await supabase.from('kb_publication').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update ingestion_queue item to unpublished (550)
  if (publication?.source_url) {
    await supabase
      .from('ingestion_queue')
      .update({ status: 'unpublished', status_code: 550 })
      .eq('url', publication.source_url)
      .eq('status_code', 400); // Only update if currently published
  }

  return NextResponse.json({ success: true });
}
