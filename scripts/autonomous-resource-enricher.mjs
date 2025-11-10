#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 3; // Process 3 at a time to avoid rate limits
const DELAY_MS = 2000; // 2 second delay between batches

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Starting autonomous resource enrichment...\n');

  // Step 1: Find resources missing summaries
  const { data: resources, error } = await supabase
    .from('kb_resource')
    .select('*')
    .or('summary_short.is.null,summary_medium.is.null,summary_long.is.null')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch resources:', error.message);
    process.exit(1);
  }

  if (!resources || resources.length === 0) {
    console.log('✅ All resources already have summaries!');
    return;
  }

  console.log(`📋 Found ${resources.length} resources needing summaries:\n`);
  resources.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title}`);
  });
  console.log('');

  // Step 2: Process each resource
  const results = [];
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    console.log(`\n[${i + 1}/${resources.length}] Processing: ${resource.title}`);
    console.log(`   URL: ${resource.url}`);

    try {
      // Extract content
      console.log('   📥 Extracting content...');
      const content = await extractContent(resource.url);

      if (!content || content.length < 200) {
        console.log('   ⚠️  Insufficient content extracted, skipping');
        results.push({ resource, success: false, error: 'insufficient_content' });
        continue;
      }

      // Generate summaries
      console.log(`   🤖 Generating summaries (${content.length} chars extracted)...`);
      const summaries = await generateSummaries(resource, content);

      if (!summaries.success) {
        console.log(`   ❌ Failed: ${summaries.error}`);
        results.push({ resource, success: false, error: summaries.error });
        continue;
      }

      // Update database
      console.log('   💾 Updating database...');
      const { error: updateError } = await supabase
        .from('kb_resource')
        .update({
          summary_short: summaries.summary_short,
          summary_medium: summaries.summary_medium,
          summary_long: summaries.summary_long,
        })
        .eq('id', resource.id);

      if (updateError) {
        console.log(`   ❌ Database update failed: ${updateError.message}`);
        results.push({ resource, success: false, error: updateError.message });
        continue;
      }

      console.log('   ✅ Success!');
      console.log(`      Short: ${summaries.summary_short.substring(0, 80)}...`);
      results.push({ resource, success: true, summaries });

      // Rate limiting
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < resources.length) {
        console.log(`\n   ⏳ Waiting ${DELAY_MS / 1000}s before next batch...`);
        await delay(DELAY_MS);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({ resource, success: false, error: error.message });
    }
  }

  // Summary report
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(70));
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed resources:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  • ${r.resource.title} (${r.error})`);
      });
  }

  console.log('\n✨ Done!');
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

async function extractContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Try to find main content
    let content = '';
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
    ];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }

    // Fallback to body
    if (!content || content.length < 500) {
      content = $('body').text();
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();

    // Limit to first 8000 characters for API efficiency
    return content.substring(0, 8000);
  } catch (error) {
    console.log(`   ⚠️  Content extraction failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// SUMMARY GENERATION (IMPROVED PROMPT)
// ============================================================================

async function generateSummaries(resource, content) {
  const prompt = `Extract three-tier summaries from this BFSI content:

<source_metadata>
Title: ${resource.title}
Author: ${resource.author || 'Unknown'}
Source: ${resource.source_name || 'Unknown'}
Type: ${resource.content_type_new || 'article'}
Industry: ${resource.industry || 'cross-bfsi'}
Topic: ${resource.topic || 'general'}
URL: ${resource.url}
</source_metadata>

<content>
${content}
</content>

Generate three summaries optimized for different contexts:

1. **summary_short** - TARGET 180 CHARACTERS (strict: 140-220):
   - Start directly with the key finding (NO "Hey," or "This paper found...")
   - Example: "AI in insurance can boost efficiency by 10-40% and cut onboarding costs. Leaders see 6x returns."
   - State ACTUAL findings with specific numbers/data
   - Conversational but direct
   - NO markdown formatting
   - Must be under 220 characters

2. **summary_medium** - TARGET 300 CHARACTERS (strict: 220-400):
   - Start with "Basically, they discovered..." or similar conversational opener
   - Expand on the core finding with 2-3 key insights
   - Include specific data points and outcomes from the content
   - Use plain spoken language
   - Simple markdown allowed (bold for emphasis)
   - Must be under 400 characters

3. **summary_long** - TARGET 800 CHARACTERS (strict: 600-1000):
   - Use this exact structure:
     ## Context
     [What's the business/market situation? 2-3 sentences]
     
     ## Relevance  
     [Why should BFSI professionals care? Specific benefits/risks]
     
     ## Key Insights
     [What did they ACTUALLY find? 3-4 concrete takeaways with data/examples]
   - Write naturally, conversational tone
   - Full markdown formatting (bold, italic, lists if needed)
   - Must be under 1000 characters

Return as JSON:
{
  "summary_short": "...",
  "summary_medium": "...",
  "summary_long": "..."
}

CRITICAL INSTRUCTIONS:
- Extract ACTUAL findings, numbers, and specific insights from the content
- NO vague statements like "explores trends" or "discusses changes"
- Be concrete: "reduced costs by 25%", "processing time from 5 days to 2 hours"
- Write conversationally but professionally
- Strictly adhere to character limits
- For BFSI context: relate to banking, insurance, financial services operations`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a senior BFSI analyst creating executive summaries. Write in clear, professional language. Extract concrete findings with specific data points. Be direct and actionable.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate
    const validation = validateSummaries(result);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    return {
      success: true,
      summary_short: result.summary_short,
      summary_medium: result.summary_medium,
      summary_long: result.summary_long,
    };
  } catch (error) {
    return {
      success: false,
      error: `OpenAI error: ${error.message}`,
    };
  }
}

function validateSummaries(summaries) {
  const errors = [];

  // Stricter validation
  if (!summaries.summary_short) {
    errors.push('summary_short missing');
  } else if (summaries.summary_short.length > 220) {
    errors.push(`summary_short too long (${summaries.summary_short.length} > 220 chars)`);
  } else if (summaries.summary_short.length < 140) {
    errors.push(`summary_short too short (${summaries.summary_short.length} < 140 chars)`);
  }

  if (!summaries.summary_medium) {
    errors.push('summary_medium missing');
  } else if (summaries.summary_medium.length > 400) {
    errors.push(`summary_medium too long (${summaries.summary_medium.length} > 400 chars)`);
  } else if (summaries.summary_medium.length < 220) {
    errors.push(`summary_medium too short (${summaries.summary_medium.length} < 220 chars)`);
  }

  if (!summaries.summary_long) {
    errors.push('summary_long missing');
  } else if (summaries.summary_long.length > 1000) {
    errors.push(`summary_long too long (${summaries.summary_long.length} > 1000 chars)`);
  } else if (summaries.summary_long.length < 600) {
    errors.push(`summary_long too short (${summaries.summary_long.length} < 600 chars)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
