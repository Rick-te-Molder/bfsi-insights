import type { APIRoute } from 'astro';

const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK || import.meta.env.CLOUDFLARE_DEPLOY_HOOK;

export const POST: APIRoute = async () => {
  if (!webhookUrl) {
    return new Response(
      JSON.stringify({ ok: false, message: 'CLOUDFLARE_DEPLOY_HOOK is not configured' }),
      { status: 500 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return new Response(JSON.stringify({ ok: false, message: body || 'Build failed' }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    );
  }
};
