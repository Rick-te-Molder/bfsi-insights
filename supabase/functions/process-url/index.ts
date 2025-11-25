import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // 1. Fetch queue item
    const { data: queueItem, error: fetchError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) {
      return new Response(JSON.stringify({ error: 'Queue item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch content from URL with timeout
    console.log(`Fetching content from: ${queueItem.url}`);
    let content;
    try {
      content = await fetchContent(queueItem.url);
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr);
      // Mark as failed so user can retry
      await supabase
        .from('ingestion_queue')
        .update({
          status: 'failed',
          rejection_reason: `Failed to fetch: ${fetchErr.message}`,
        })
        .eq('id', queueId);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch content: ${fetchErr.message}. Site may be blocking requests.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Enrich with AI
    console.log('Enriching with OpenAI...');
    const enrichment = await generateEnrichment(content.title, content.description);

    // 4. Update queue with enriched data
    const updatedPayload = {
      ...queueItem.payload,
      title: content.title,
      description: content.description,
      published_at: content.date || new Date().toISOString(),
      summary: enrichment.summary,
      tags: enrichment.tags,
      persona_scores: enrichment.persona_scores,
    };

    const { error: updateError } = await supabase
      .from('ingestion_queue')
      .update({
        status: enrichment.bfsi_relevant ? 'enriched' : 'rejected',
        payload: updatedPayload,
        content_type: 'publication',
        fetched_at: new Date().toISOString(),
        rejection_reason: enrichment.bfsi_relevant ? null : enrichment.relevance_reason,
      })
      .eq('id', queueId);

    if (updateError) {
      throw new Error(`Failed to update queue: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: enrichment.bfsi_relevant ? 'enriched' : 'rejected',
        title: content.title,
        reason: enrichment.bfsi_relevant ? null : enrichment.relevance_reason,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error processing URL:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fetch content from URL with timeout
async function fetchContent(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return parseHtml(html, url);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 30s');
    }
    throw error;
  }
}

function parseHtml(html: string, url: string) {
  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

  const dateMatch =
    html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<time[^>]*datetime=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(url),
    description: descMatch ? descMatch[1].trim() : '',
    date: dateMatch ? dateMatch[1].trim() : null,
  };
}

function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname
      .split('/')
      .filter(Boolean)
      .pop()!
      .replace(/[-_]/g, ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

// Generate enrichment using OpenAI
async function generateEnrichment(title: string, description: string) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  const content = description || title;

  const prompt = `You are an expert curator for a BFSI (Banking, Financial Services, Insurance) knowledge base.

Analyze this article and determine if it's relevant to BFSI professionals (executives, practitioners, researchers).

Title: ${title}
Content: ${content}

Provide:
1. Is this BFSI-relevant? (true/false)
2. Relevance reason (short explanation)
3. Three summaries: short (~150 chars), medium (~300 chars), long (~600 chars)
4. Up to 5 tags (e.g., "AI", "Risk Management", "Compliance")
5. Persona relevance scores (0-1): executive, professional, researcher

Respond as JSON:
{
  "bfsi_relevant": true/false,
  "relevance_reason": "string",
  "relevance_confidence": 0.0-1.0,
  "summary": {
    "short": "string",
    "medium": "string",
    "long": "string"
  },
  "tags": ["tag1", "tag2"],
  "persona_scores": {
    "executive": 0.0-1.0,
    "professional": 0.0-1.0,
    "researcher": 0.0-1.0
  }
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a BFSI content curator. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  return result;
}
