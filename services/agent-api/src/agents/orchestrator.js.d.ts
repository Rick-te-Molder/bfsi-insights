export function processQueue(options?: {
  limit?: number;
  includeThumbnail?: boolean;
}): Promise<{ processed: number; enriched?: number; success: number; failed: number }>;
