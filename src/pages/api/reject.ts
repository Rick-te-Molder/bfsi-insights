import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { id, reason } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_KEY,
    );

    const { data, error } = await supabase.rpc('reject_from_queue', {
      p_queue_id: id,
      p_reason: reason || null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
