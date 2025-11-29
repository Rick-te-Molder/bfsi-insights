import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Enqueue URL - Thin Edge Function
 *
 * Just validates and marks the item as 'queued' for processing.
 * Agent API handles all enrichment logic (DRY).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { queueId } = await req.json();

    if (!queueId) {
      return new Response(JSON.stringify({ error: 'queueId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch queue item to validate it exists
    const { data: queueItem, error: fetchError } = await supabase
      .from('ingestion_queue')
      .select('id, url, status')
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) {
      return new Response(JSON.stringify({ error: 'Queue item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only process pending items
    if (queueItem.status !== 'pending') {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Item already has status: ${queueItem.status}`,
          status: queueItem.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark as 'queued' - Agent API will process it
    const { error: updateError } = await supabase
      .from('ingestion_queue')
      .update({ status: 'queued' })
      .eq('id', queueId);

    if (updateError) {
      throw new Error(`Failed to update queue: ${updateError.message}`);
    }

    // Optionally kick Agent API to process immediately
    // (If Agent API is hosted, we could POST to it here)
    // For now, Agent API polls for 'queued' items

    return new Response(
      JSON.stringify({
        success: true,
        status: 'queued',
        message: 'Item queued for processing by Agent API',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error enqueuing URL:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
