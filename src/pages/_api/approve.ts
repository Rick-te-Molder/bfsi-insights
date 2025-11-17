import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Verify session
    const supabaseAuth = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    const { id } = await request.json();
    console.log('API received ID:', id, 'Type:', typeof id);
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
    }

    // Use service key for admin operations
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_KEY,
    );

    const { error } = await supabase.rpc('approve_from_queue', { p_queue_id: id });

    if (error) {
      console.error('Supabase RPC error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Approve error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 },
    );
  }
};
