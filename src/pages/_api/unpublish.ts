import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Auth via access/refresh cookies
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

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

    const { id, reason } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
    }

    // Service client for RPC
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_KEY,
    );

    const { data, error } = await supabase.rpc('unpublish_resource', {
      p_resource_id: id,
      p_reason: reason || null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
