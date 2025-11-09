#!/usr/bin/env node
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummaries(resource, extractedContent) {
  // Handle PDFs differently - upload to OpenAI
  if (extractedContent.isPdf) {
    return await generateSummariesFromPDF(resource, extractedContent);
  }

  // Handle HTML/text content
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

1. **summary_short** - MUST BE 120-240 CHARACTERS:
   - Compelling hook for card display
   - Scannable, punchy
   - Focus on key value proposition
   - NO markdown formatting
   - CRITICAL: Must be AT LEAST 120 characters, maximum 240

2. **summary_medium** - MUST BE 240-480 CHARACTERS:
   - Narrative preview for modal display
   - Engaging, informative
   - Explain what readers will learn
   - Simple markdown allowed (bold, italic)
   - CRITICAL: Must be AT LEAST 240 characters, maximum 480

3. **summary_long** - MUST BE 640-1120 CHARACTERS:
   - Structured overview for detail page
   - Use this exact structure:
     ## Context
     [Brief background and setting]
     
     ## Relevance
     [Why this matters to BFSI professionals]
     
     ## Key Insights
     [Main takeaways, 2-3 bullet points]
   - Full markdown formatting
   - CRITICAL: Must be AT LEAST 640 characters, maximum 1120

Return as JSON:
{
  "summary_short": "...",
  "summary_medium": "...",
  "summary_long": "..."
}

IMPORTANT: Each summary MUST meet the minimum character requirements. Count characters carefully before responding.`;
}

/**
 * Generate summaries from PDF using metadata (temporary solution)
 * TODO: Implement proper PDF extraction using external service for scale
 */
async function generateSummariesFromPDF(resource, extractedContent) {
  try {
    const prompt = buildPromptForPDF(resource);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at creating tiered summaries for BFSI knowledge resources. Based on title and metadata provided, generate precise summaries.',
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
        source: 'pdf_metadata',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `PDF summary generation failed: ${error.message}`,
    };
  }
}

function buildPromptForPDF(resource) {
  const existingNote = resource.note || 'No additional context available';
  
  return `Generate three-tier summaries for this BFSI PDF document based on its metadata and existing notes.

<source_metadata>
Title: ${resource.title}
Authors: ${resource.authors?.join(', ') || 'Unknown'}
Source: ${resource.source_name || 'Unknown'}
Type: ${resource.content_type}
Industry: ${resource.industry}
Topic: ${resource.topic}
URL: ${resource.url}
</source_metadata>

<existing_notes>
${existingNote}
</existing_notes>

Based on this information, generate three summaries optimized for different contexts:

1. **summary_short** - MUST BE 120-240 CHARACTERS:
   - Compelling hook for card display
   - Scannable, punchy
   - Focus on key value proposition
   - NO markdown formatting
   - CRITICAL: Must be AT LEAST 120 characters, maximum 240

2. **summary_medium** - MUST BE 240-480 CHARACTERS:
   - Narrative preview for modal display
   - Engaging, informative
   - Explain what readers will learn
   - Simple markdown allowed (bold, italic)
   - CRITICAL: Must be AT LEAST 240 characters, maximum 480

3. **summary_long** - MUST BE 640-1120 CHARACTERS:
   - Structured overview for detail page
   - Use this exact structure:
     ## Context
     [Brief background and setting]
     
     ## Relevance
     [Why this matters to BFSI professionals]
     
     ## Key Insights
     [Main takeaways, 2-3 bullet points]
   - Full markdown formatting
   - CRITICAL: Must be AT LEAST 640 characters, maximum 1120

Return as JSON:
{
  "summary_short": "...",
  "summary_medium": "...",
  "summary_long": "..."
}

IMPORTANT: Each summary MUST meet the minimum character requirements. Count characters carefully before responding.`;
}

function validateSummaries(summaries) {
  const errors = [];

  if (!summaries.summary_short) errors.push('summary_short missing');
  else if (summaries.summary_short.length < 120 || summaries.summary_short.length > 240)
    errors.push(`summary_short length (${summaries.summary_short.length}) not in 120-240 range`);

  if (!summaries.summary_medium) errors.push('summary_medium missing');
  else if (summaries.summary_medium.length < 240 || summaries.summary_medium.length > 480)
    errors.push(
      `summary_medium length (${summaries.summary_medium.length}) not in 240-480 range`,
    );

  if (!summaries.summary_long) errors.push('summary_long missing');
  else if (summaries.summary_long.length < 640 || summaries.summary_long.length > 1120)
    errors.push(`summary_long length (${summaries.summary_long.length}) not in 640-1120 range`);

  return {
    valid: errors.length === 0,
    errors,
  };
}
