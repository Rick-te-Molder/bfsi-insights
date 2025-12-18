import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import process from 'node:process';

const runner = new AgentRunner('summarizer');

/**
 * Clean title by removing common source suffixes
 * Examples: "Title | OCC", "Title - McKinsey", "Title | Reuters"
 */
function cleanTitle(title) {
  if (!title) return title;

  // Use string operations to avoid ReDoS vulnerability
  const separators = [' | ', ' - ', ' – ', ' — ', ' :: '];

  let cleaned = title;
  for (const sep of separators) {
    const lastIndex = cleaned.lastIndexOf(sep);
    if (lastIndex > 0) {
      const suffix = cleaned.slice(lastIndex + sep.length).trim();
      // Only remove if suffix looks like a source name (1-4 words, starts with capital)
      if (suffix.length > 0 && suffix.length <= 40 && /^[A-Z]/.test(suffix)) {
        const wordCount = suffix.split(/\s+/).length;
        if (wordCount <= 4) {
          cleaned = cleaned.slice(0, lastIndex);
        }
      }
    }
  }

  return cleaned.trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Enhanced schema with structured output
const SummarySchema = z.object({
  // Metadata extraction
  title: z.string().describe('Cleaned-up professional title'),
  published_at: z
    .string()
    .nullable()
    .describe('ISO 8601 date (YYYY-MM-DD). Extract from content. Null only if not found.'),

  // Authors with context
  authors: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().nullable().describe('Job title, affiliation, or role'),
        authority: z
          .string()
          .nullable()
          .describe(
            'Why this author is credible (e.g., "Partner at McKinsey", "Professor at MIT")',
          ),
      }),
    )
    .describe('Authors with evidence of relevance and authority'),

  // Structured summary - CHARACTER counts for UI display
  summary: z.object({
    short: z.string().describe('1-2 sentences, 120-150 characters total. Used on cards.'),
    medium: z.string().describe('2-3 sentences, 250-300 characters total. Used in modals.'),
    long: z
      .string()
      .describe(
        'Structured markdown for detail pages (600-800 chars). Follow long_summary_format rule.',
      ),
  }),

  // Long summary broken into sections (for detail page)
  long_summary_sections: z.object({
    overview: z.string().describe('2-3 sentences listing main topics covered'),
    key_insights: z.array(
      z.object({
        insight: z.string().describe('The claim or finding'),
        evidence: z.string().nullable().describe('Supporting data or source'),
        verifiable: z.boolean().describe('Can be independently verified?'),
      }),
    ),
    why_it_matters: z.string().describe('1-2 sentences'),
    actionable_implications: z.array(z.string()).describe('List of action items'),
  }),

  // Entities to potentially add to taxonomy
  entities: z.object({
    organizations: z
      .array(
        z.object({
          name: z.string(),
          type: z.string().describe('bank, insurer, asset_manager, regulator, consultancy, other'),
          context: z.string().describe('How mentioned in the article'),
        }),
      )
      .describe('BFSI organisations mentioned'),
    vendors: z
      .array(
        z.object({
          name: z.string(),
          product_or_service: z.string().nullable(),
          context: z.string().describe('How mentioned in the article'),
        }),
      )
      .describe('Technology vendors, AI providers, software companies'),
  }),

  // Academic paper specific
  is_academic: z.boolean().describe('Is this a peer-reviewed academic paper?'),
  citations: z
    .array(z.string())
    .nullable()
    .describe('Key citations for academic papers. Format: "Author (Year). Title."'),

  // Key figures/data points for quick scanning
  key_figures: z
    .array(
      z.object({
        metric: z.string().describe('What is being measured'),
        value: z.string().describe('The number or percentage'),
        context: z.string().describe('Brief context for the figure'),
      }),
    )
    .describe('Specific numbers, percentages, amounts mentioned'),
});

// Load writing rules from database
async function loadWritingRules() {
  const { data: rules } = await supabase
    .from('writing_rules')
    .select('category, rule_name, rule_text')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules?.length) return '';

  // Group by category
  const grouped = rules.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(`• ${r.rule_name}: ${r.rule_text}`);
    return acc;
  }, {});

  // Format as text
  return Object.entries(grouped)
    .map(([cat, items]) => `## ${cat.toUpperCase()} RULES\n${items.join('\n')}`)
    .join('\n\n');
}

// JSON schema description for Claude (must match SummarySchema)
const JSON_SCHEMA_DESCRIPTION = `
Output a JSON object with this exact structure:
{
  "title": "string - cleaned-up professional title",
  "published_at": "string|null - ISO 8601 date (YYYY-MM-DD) or null",
  "authors": [{"name": "string", "role": "string|null", "authority": "string|null"}],
  "summary": {
    "short": "string - 1-2 sentences, 120-150 characters total (for cards)",
    "medium": "string - 2-3 sentences, 250-300 characters total (for modals)", 
    "long": "string - structured markdown (600-800 chars) following long_summary_format rule from WRITING RULES"
  },
  "long_summary_sections": {
    "overview": "string - 2-3 sentences listing main topics covered",
    "key_insights": [{"insight": "string", "evidence": "string|null", "verifiable": boolean}],
    "why_it_matters": "string - 1-2 sentences",
    "actionable_implications": ["string"]
  },
  "entities": {
    "organizations": [{"name": "string", "type": "string", "context": "string"}],
    "vendors": [{"name": "string", "product_or_service": "string|null", "context": "string"}]
  },
  "is_academic": boolean,
  "citations": ["string"]|null,
  "key_figures": [{"metric": "string", "value": "string", "context": "string"}]
}`;

// Lazy-load Anthropic client
let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for summarizer');
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export async function runSummarizer(queueItem, options = {}) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
      promptOverride: options.promptOverride,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const anthropic = getAnthropic();
      const modelId = tools.model || 'claude-sonnet-4-20250514';

      // Load writing rules dynamically
      const writingRules = await loadWritingRules();

      // Use full text content if available, otherwise fall back to description
      const content = payload.textContent || payload.description || payload.title;

      // Combine base prompt with writing rules and JSON schema
      const fullPrompt = `${promptTemplate}

---
WRITING RULES (follow these strictly):
${writingRules}

---
OUTPUT FORMAT:
${JSON_SCHEMA_DESCRIPTION}

Respond with ONLY the JSON object, no markdown code blocks or other text.`;

      const maxTokens = tools.promptConfig?.max_tokens;
      const message = await anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: `${fullPrompt}\n\n---\n\nTitle: ${payload.title}\nURL: ${payload.url || ''}\n\nContent:\n${content}`,
          },
        ],
      });

      // Parse JSON response
      const responseText = message.content[0].text;
      let parsed;
      try {
        // Extract JSON from response, handling optional markdown code blocks
        let jsonContent = responseText.trim();
        if (jsonContent.startsWith('```')) {
          const endIndex = jsonContent.lastIndexOf('```');
          const startIndex = jsonContent.indexOf('\n') + 1;
          if (endIndex > startIndex) {
            jsonContent = jsonContent.slice(startIndex, endIndex).trim();
          }
        }
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        throw new Error(
          `Failed to parse Claude response as JSON: ${e.message}\nResponse: ${responseText.substring(0, 500)}`,
        );
      }

      // Validate with Zod schema
      const result = SummarySchema.parse(parsed);

      const usage = {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        model: modelId,
      };

      // Flatten for backward compatibility
      return {
        title: cleanTitle(result.title),
        published_at: result.published_at,
        author: result.authors?.map((a) => a.name).join(', ') || null,
        authors: result.authors,
        summary: result.summary,
        long_summary_sections: result.long_summary_sections,
        key_takeaways: result.long_summary_sections.key_insights.map((i) => i.insight),
        key_figures: result.key_figures,
        entities: result.entities,
        is_academic: result.is_academic,
        citations: result.citations,
        usage,
      };
    },
  );
}
