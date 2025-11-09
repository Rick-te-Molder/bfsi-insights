#!/usr/bin/env node
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummaries(resource, extractedContent) {
  // Both HTML and PDF content are now text-based
  const prompt = buildPrompt(resource, extractedContent);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at creating tiered summaries for BFSI (Banking, Financial Services, Insurance) knowledge resources. Generate precise, engaging summaries that help professionals quickly understand content relevance.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content);

    const validation = validateSummaries(result);
    if (!validation.valid) {
      return {
        success: false,
        error: 'validation_failed',
        message: validation.errors.join(', '),
        raw: result,
      };
    }

    return {
      success: true,
      summaries: {
        summary_short: result.summary_short,
        summary_medium: result.summary_medium,
        summary_long: result.summary_long,
      },
      metadata: {
        model: 'gpt-4o',
        tokens: response.usage,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `OpenAI API error: ${error.message}`,
    };
  }
}

function buildPrompt(resource, extractedContent) {
  return `Extract three-tier summaries from this BFSI content:

<source_metadata>
Title: ${resource.title}
Type: ${resource.content_type}
Industry: ${resource.industry}
Topic: ${resource.topic}
URL: ${resource.url}
</source_metadata>

<content>
${extractedContent.content || extractedContent.excerpt || 'No content available'}
</content>

Generate three summaries optimized for different contexts:

1. **summary_short** - TARGET 180 CHARACTERS (acceptable: 120-240):
   - Compelling hook for card display
   - Scannable, punchy
   - Focus on key value proposition
   - NO markdown formatting
   - Aim for exactly 180 characters, can be ±60 chars

2. **summary_medium** - TARGET 360 CHARACTERS (acceptable: 240-480):
   - Narrative preview for modal display
   - Engaging, informative
   - Explain what readers will learn
   - Simple markdown allowed (bold, italic)
   - Aim for exactly 360 characters, can be ±120 chars

3. **summary_long** - TARGET 880 CHARACTERS (acceptable: 640-1120):
   - Structured overview for detail page
   - Use this exact structure:
     ## Context
     [Brief background and setting]
     
     ## Relevance
     [Why this matters to BFSI professionals]
     
     ## Key Insights
     [Main takeaways, 2-3 bullet points]
   - Full markdown formatting
   - Aim for exactly 880 characters, can be ±240 chars

Return as JSON:
{
  "summary_short": "...",
  "summary_medium": "...",
  "summary_long": "..."
}

CRITICAL: Aim for the TARGET character counts. Count your characters carefully and adjust to hit the targets as closely as possible.`;
}

function validateSummaries(summaries) {
  const errors = [];

  if (!summaries.summary_short) errors.push('summary_short missing');
  else if (summaries.summary_short.length < 120 || summaries.summary_short.length > 240)
    errors.push(`summary_short length (${summaries.summary_short.length}) not in 120-240 range`);

  if (!summaries.summary_medium) errors.push('summary_medium missing');
  else if (summaries.summary_medium.length < 240 || summaries.summary_medium.length > 480)
    errors.push(`summary_medium length (${summaries.summary_medium.length}) not in 240-480 range`);

  if (!summaries.summary_long) errors.push('summary_long missing');
  else if (summaries.summary_long.length < 640 || summaries.summary_long.length > 1120)
    errors.push(`summary_long length (${summaries.summary_long.length}) not in 640-1120 range`);

  return {
    valid: errors.length === 0,
    errors,
  };
}
