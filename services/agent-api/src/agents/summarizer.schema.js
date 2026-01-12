import { z } from 'zod';

// Enhanced schema with structured output
export const SummarySchema = z.object({
  // Metadata extraction
  title: z.string().describe('Cleaned-up professional title'),
  published_at: z
    .string()
    .nullable()
    .describe(
      'Date in YYYY-MM-DD format if day is known, or YYYY-MM if only month/year available. Null only if not found.',
    ),

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

// JSON schema description for Claude (must match SummarySchema)
export const JSON_SCHEMA_DESCRIPTION = `
Output a JSON object with this exact structure:
{
  "title": "string - cleaned-up professional title",
  "published_at": "string|null - YYYY-MM-DD if day known, YYYY-MM if only month/year, or null",
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
