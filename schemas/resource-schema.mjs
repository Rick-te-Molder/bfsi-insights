import { z } from 'zod';

// Generated from kb.schema.json - keep in sync with canonical schema
// This schema is more lenient for runtime validation and includes transformations

const normalizeArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Enums from kb.schema.json
const RoleEnum = z.enum(['executive', 'professional', 'academic']);

const IndustryEnum = z.enum([
  'banking',
  'banking-retail-banking',
  'banking-corporate-banking',
  'banking-lending',
  'banking-payments',
  'banking-deposits',
  'banking-treasury',
  'banking-capital-markets',
  'banking-digital-banking',
  'financial-services',
  'financial-services-financial-advice',
  'financial-services-wealth-management',
  'financial-services-asset-management',
  'financial-services-leasing',
  'financial-services-factoring',
  'financial-services-pension-funds',
  'financial-services-insurance-brokerage',
  'insurance',
  'insurance-health-insurance',
  'insurance-life-insurance',
  'insurance-pension-insurance',
  'insurance-property-and-casualty',
  'cross-bfsi',
  'cross-bfsi-infrastructure',
  'cross-bfsi-shared-services',
  'cross-bfsi-b2b-platforms',
]);

const TopicEnum = z.enum([
  'strategy-and-management',
  'strategy-and-management-strategy',
  'strategy-and-management-operating-models',
  'strategy-and-management-transformation',
  'strategy-and-management-case-studies',
  'ecosystem',
  'ecosystem-vendors',
  'ecosystem-institutions',
  'ecosystem-bfsi-sector',
  'ecosystem-ai-industry',
  'governance-and-control',
  'governance-and-control-governance',
  'governance-and-control-risk-management',
  'governance-and-control-compliance',
  'governance-and-control-financial-crime-prevention',
  'governance-and-control-financial-crime-prevention-kyc',
  'governance-and-control-financial-crime-prevention-cdd',
  'governance-and-control-financial-crime-prevention-aml',
  'governance-and-control-financial-crime-prevention-fraud-detection',
  'governance-and-control-financial-crime-prevention-sanctions-screening',
  'governance-and-control-auditing',
  'governance-and-control-internal-controls',
  'regulatory-and-standards',
  'regulatory-and-standards-regulation',
  'regulatory-and-standards-standards',
  'regulatory-and-standards-policy',
  'regulatory-and-standards-guidance',
  'technology-and-data',
  'technology-and-data-ai',
  'technology-and-data-agentic-engineering',
  'technology-and-data-rag',
  'technology-and-data-orchestration',
  'technology-and-data-data-management',
  'technology-and-data-infrastructure',
  'technology-and-data-cybersecurity',
  'technology-and-data-monitoring',
  'methods-and-approaches',
  'methods-and-approaches-methodology',
  'methods-and-approaches-models',
  'methods-and-approaches-best-practices',
]);

const UseCasesEnum = z.enum([
  'customer-onboarding',
  'identity-verification',
  'document-processing',
  'transaction-monitoring',
  'credit-assessment',
  'fraud-detection',
  'claims-handling',
  'portfolio-analytics',
  'regulatory-reporting',
  'audit-support',
]);

const AgenticCapabilitiesEnum = z.enum([
  'reasoning',
  'planning',
  'memory',
  'tool-use',
  'collaboration',
  'autonomy',
  'evaluation',
  'monitoring',
]);

const ContentTypeEnum = z.enum([
  'report',
  'white-paper',
  'peer-reviewed-paper',
  'article',
  'presentation',
  'webinar',
  'dataset',
  'website',
  'policy-document',
]);

const JurisdictionEnum = z.enum(['eu', 'uk', 'us', 'nl', 'global', 'other']);

export const Resource = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  authors: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform(normalizeArray),
  source_name: z.string().optional(),
  source_domain: z.string().optional(),
  thumbnail: z.string().optional(),
  date_published: z.string().optional(), // date format validated in kb.schema.json
  date_added: z.string().optional(), // date-time format validated in kb.schema.json
  last_edited: z.string().optional(), // date-time format validated in kb.schema.json
  role: RoleEnum.optional(),
  industry: IndustryEnum.optional(),
  // Allow string or array for flexibility, transform to array
  topic: z
    .union([TopicEnum, z.array(TopicEnum)])
    .optional()
    .transform(normalizeArray),
  use_cases: UseCasesEnum.optional(),
  agentic_capabilities: AgenticCapabilitiesEnum.optional(),
  // Allow string or array for flexibility, transform to array
  content_type: z
    .union([ContentTypeEnum, z.array(ContentTypeEnum)])
    .optional()
    .transform(normalizeArray),
  jurisdiction: JurisdictionEnum.optional(),
  note: z.string().optional(),
  summary_short: z.string().min(120).max(240).optional(),
  summary_medium: z.string().min(240).max(480).optional(),
  summary_long: z.string().min(640).max(1120).optional(),
  id: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .optional(),
});

export const Resources = z.array(Resource);

export function parseResources(data) {
  const res = Resources.safeParse(data);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid resources (count=${res.error.issues.length})\n` + issues.join('\n'));
  }
  return res.data;
}
