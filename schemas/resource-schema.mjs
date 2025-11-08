import { z } from 'zod';

const StringOrStringArray = z.union([z.string(), z.array(z.string())]).optional();
const normalizeArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export const Resource = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  source_name: z.string().optional(),
  date_added: z.string().optional(),
  date_published: z.string().optional(),
  last_edited: z.string().optional(),
  thumbnail: z.string().optional(),
  topic: StringOrStringArray.transform(normalizeArray),
  content_type: StringOrStringArray.transform(normalizeArray),
  role: z.string().optional(),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
  authors: z.union([z.array(z.string()), z.string()]).optional().transform(normalizeArray),
  note: z.string().optional(),
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
