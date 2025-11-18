/* eslint-env node */
import { env } from 'node:process';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ silent: true });

// Generated from kb.schema.json - keep in sync with canonical schema
// This schema is more lenient for runtime validation and includes transformations

const normalizeArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Fetch valid taxonomies dynamically from database
let RoleEnum, IndustryEnum;
try {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [rolesData, industriesData] = await Promise.all([
      supabase.from('ref_role').select('value').order('sort_order'),
      supabase.from('bfsi_industry').select('code'), // Load all levels, not just top-level
    ]);

    // Roles
    if (rolesData.data && rolesData.data.length > 0) {
      RoleEnum = z.enum(rolesData.data.map((r) => r.value));
    } else {
      RoleEnum = z.enum(['executive', 'professional', 'researcher']);
    }

    // Industries
    if (industriesData.error) {
      console.error('Error loading industries from DB:', industriesData.error);
      IndustryEnum = z.enum(['banking', 'financial-services', 'insurance', 'cross-bfsi', 'other']);
    } else if (industriesData.data && industriesData.data.length > 0) {
      IndustryEnum = z.enum(industriesData.data.map((i) => i.code));
    } else {
      console.warn('No industries found in database, using fallback');
      IndustryEnum = z.enum(['banking', 'financial-services', 'insurance', 'cross-bfsi', 'other']);
    }
  } else {
    // Fallback if no credentials
    RoleEnum = z.enum(['executive', 'professional', 'researcher']);
    IndustryEnum = z.enum(['banking', 'financial-services', 'insurance', 'cross-bfsi', 'other']);
  }
} catch {
  // Fallback if fetch fails
  RoleEnum = z.enum(['executive', 'professional', 'researcher']);
  IndustryEnum = z.enum(['banking', 'financial-services', 'insurance', 'cross-bfsi', 'other']);
}

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

const GeographyEnum = z.enum(['eu', 'uk', 'us', 'nl', 'global', 'other']);

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
  // Topics are dynamic from database, accept any string/array
  topic: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(normalizeArray),
  use_cases: UseCasesEnum.optional(),
  agentic_capabilities: AgenticCapabilitiesEnum.optional(),
  // Allow string or array for flexibility, transform to array
  content_type: z
    .union([ContentTypeEnum, z.array(ContentTypeEnum)])
    .optional()
    .transform(normalizeArray),
  geography: GeographyEnum.optional(),
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
