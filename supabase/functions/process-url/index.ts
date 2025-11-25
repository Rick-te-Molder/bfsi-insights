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
      industry_codes: enrichment.industry_codes || [],
      topic_codes: enrichment.topic_codes || [],
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

// Load taxonomy from database
let TAXONOMY_CACHE: {
  industries: Array<{ code: string; name: string }>;
  topics: Array<{ code: string; name: string }>;
} | null = null;

async function loadTaxonomy() {
  if (TAXONOMY_CACHE) return TAXONOMY_CACHE;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PUBLIC_SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const [industriesRes, topicsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/bfsi_industry?select=code,name&order=sort_order`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }),
    fetch(`${supabaseUrl}/rest/v1/bfsi_topic?select=code,name&order=sort_order`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }),
  ]);

  const industries = await industriesRes.json();
  const topics = await topicsRes.json();

  TAXONOMY_CACHE = { industries, topics };
  return TAXONOMY_CACHE;
}

// Generate enrichment using OpenAI
async function generateEnrichment(title: string, description: string) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  const content = description || title;

  // Load taxonomy
  const taxonomy = await loadTaxonomy();
  const industryList = taxonomy.industries.map((i) => `${i.code}: ${i.name}`).join('\n');
  const topicList = taxonomy.topics.map((t) => `${t.code}: ${t.name}`).join('\n');

  const prompt = `You are an expert curator for a BFSI (Banking, Financial Services, Insurance) knowledge base.

Analyze this article and determine if it's relevant to BFSI professionals.

Title: ${title}
Content: ${content}

Provide:
1. BFSI relevance assessment (true/false with reason)
2. Three DISTINCT summaries with STRICT character limits:
   - SHORT: 120-150 characters, one punchy sentence highlighting the main value
   - MEDIUM: 250-300 characters, two sentences explaining what and why it matters
   - LONG: 500-600 characters, comprehensive paragraph with key insights, claims the authors make, key figures mentioned and concrete implications for BFSI
3. Select 1-3 relevant INDUSTRY codes from this list:
${industryList}

4. Select 1-2 relevant TOPIC codes from this list:
${topicList}

5. Persona relevance scores (0-1) based on content depth and actionability

IMPORTANT:
- Each summary must be progressively MORE detailed, not repetitive
- Use concrete, specific language - avoid generic phrases
- Focus on actionable insights and business value
- NO marketing fluff or empty statements
- Use ONLY the codes from the lists above

Respond as JSON:
{
  "bfsi_relevant": true/false,
  "relevance_reason": "string",
  "relevance_confidence": 0.0-1.0,
  "summary": {
    "short": "string (120-150 chars)",
    "medium": "string (250-300 chars)",
    "long": "string (500-600 chars)"
  },
  "industry_codes": ["code1", "code2"],
  "topic_codes": ["code1", "code2"],
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
