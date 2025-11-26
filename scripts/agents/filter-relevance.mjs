#!/usr/bin/env node
/**
 * Relevance Filter Agent
 * Fast BFSI relevance check using GPT-4o-mini
 * Processes 'fetched' items → sets to 'filtered' or 'rejected'
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const MODEL = 'gpt-4o-mini'; // Cheap model for filtering

async function filterRelevance() {
  console.log('🔍 Relevance filtering starting...');
  console.log(`Mode: LIVE\n`);

  // Debug: check if env vars loaded
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'loaded' : 'MISSING');
    console.error('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'loaded' : 'MISSING');
    process.exit(1);
  }

  // Create clients inside function so env vars are loaded
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Parse limit from CLI
  const args = process.argv.slice(2);
  let limit = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      console.log(`Limit: ${limit}\n`);
      break;
    }
  }

  // Fetch items that need filtering
  let query = supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .eq('status', 'fetched')
    .order('discovered_at', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error('❌ Error fetching items:', error);
    return;
  }

  if (!items || items.length === 0) {
    console.log('✅ No items to filter\n');
    return;
  }

  console.log(`📋 Found ${items.length} items to filter\n`);

  let relevant = 0;
  let rejected = 0;

  for (const item of items) {
    const title = item.payload?.title || 'No title';
    const description = item.payload?.description || '';

    console.log(`📝 ${title.substring(0, 60)}...`);

    try {
      const isRelevant = await checkBFSIRelevance(title, description, item.url, openai);

      if (isRelevant.relevant) {
        // Mark as filtered (ready for enrichment)
        const { error: updateError } = await supabase
          .from('ingestion_queue')
          .update({ status: 'filtered' })
          .eq('id', item.id);

        if (updateError) {
          console.error(`   ❌ Update failed: ${updateError.message}`);
        } else {
          console.log('   ✅ BFSI relevant - marked for enrichment');
          relevant++;
        }
      } else {
        // Reject - not relevant
        const { error: updateError } = await supabase
          .from('ingestion_queue')
          .update({
            status: 'rejected',
            rejection_reason: isRelevant.reason,
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`   ❌ Update failed: ${updateError.message}`);
        } else {
          console.log(`   ⚠️  Not relevant: ${isRelevant.reason}`);
          rejected++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n📊 Filtered ${relevant + rejected} items`);
  console.log(`   ✅ Relevant: ${relevant}`);
  console.log(`   ⚠️  Rejected: ${rejected}\n`);
  console.log('✨ Filtering complete\n');
}

async function checkBFSIRelevance(title, description, url, openai) {
  const prompt = `Is this article relevant to BFSI (Banking, Financial Services, Insurance)?

Title: ${title}
Description: ${description}
URL: ${url}

BFSI includes:
- Banking (retail, corporate, digital banking)
- Insurance (life, health, property, insurtech)
- Financial services (payments, wealth management, fintech)
- Regulation (compliance, risk management, supervision)
- Technology in finance (AI, blockchain, cybersecurity in BFSI)

Respond with JSON:
{
  "relevant": true/false,
  "reason": "brief explanation (max 100 chars)"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a BFSI content filter. Respond only with valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 150,
  });

  const content = response.choices[0].message.content.trim();

  // Try to parse JSON response
  try {
    // Remove markdown code blocks if present
    const jsonStr = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(jsonStr);
  } catch {
    // Fallback: look for relevant: true/false
    const relevant = content.toLowerCase().includes('"relevant": true');
    return {
      relevant,
      reason: relevant ? 'BFSI relevant' : 'Not BFSI relevant',
    };
  }
}

// Run the filter
filterRelevance().catch(console.error);
