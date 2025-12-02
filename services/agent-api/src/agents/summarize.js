import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const runner = new AgentRunner('content-summarizer');

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

  // Structured summary
  summary: z.object({
    short: z.string().describe('1-2 sentences. Lead with the key finding. Max 50 words.'),
    medium: z.string().describe('3-5 sentences. Key findings and implications. Max 150 words.'),
    long: z
      .string()
      .describe(
        'Comprehensive summary with structure. See long_summary_sections for structured version.',
      ),
  }),

  // Long summary broken into sections (for detail page)
  long_summary_sections: z.object({
    overview: z.string().describe('2-3 sentences summarising the main thesis'),
    key_insights: z
      .array(
        z.object({
          insight: z.string().describe('The claim or finding'),
          evidence: z.string().nullable().describe('Supporting data, figures, or source'),
          verifiable: z.boolean().describe('Can this be independently verified?'),
        }),
      )
      .describe('Key claims with evidence. Include specific figures, percentages, amounts.'),
    why_it_matters: z.string().describe('1-2 sentences on why this matters for BFSI professionals'),
    actionable_implications: z
      .array(z.string())
      .describe('What BFSI professionals should do with this information'),
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

export async function runSummarizer(queueItem) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

      // Load writing rules dynamically
      const writingRules = await loadWritingRules();

      // Use full text content if available, otherwise fall back to description
      const content = payload.textContent || payload.description || payload.title;

      // Combine base prompt with writing rules
      const fullPrompt = `${promptTemplate}

---
WRITING RULES (follow these strictly):
${writingRules}`;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: fullPrompt },
          {
            role: 'user',
            content: `Title: ${payload.title}\nURL: ${payload.url || ''}\n\nContent:\n${content}`,
          },
        ],
        response_format: zodResponseFormat(SummarySchema, 'summary'),
        temperature: 0.2,
      });

      const result = completion.choices[0].message.parsed;
      const usage = completion.usage;

      // Flatten for backward compatibility
      return {
        title: result.title,
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
