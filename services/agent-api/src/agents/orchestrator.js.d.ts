export function processQueue(options?: {
  limit?: number;
  includeThumbnail?: boolean;
}): Promise<{ processed: number; success: number; failed: number }>;
