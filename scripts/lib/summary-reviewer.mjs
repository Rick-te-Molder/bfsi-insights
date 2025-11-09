#!/usr/bin/env node
import fs from 'node:fs/promises';

export async function saveForReview(results, outputPath) {
  const reviewData = {
    generated_at: new Date().toISOString(),
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    resources: results.map((r) => ({
      filename: r.filename,
      slug: r.resource.slug,
      title: r.resource.title,
      url: r.resource.url,
      status: r.success ? 'pending_review' : 'failed',
      error: r.error,
      extracted_content_preview: r.extractedContent?.content?.substring(0, 500),
      summaries: r.summaries || null,
      metadata: r.metadata || null,
    })),
  };

  await fs.writeFile(outputPath, JSON.stringify(reviewData, null, 2));
  return reviewData;
}

export async function loadReviewedSummaries(reviewPath) {
  const content = await fs.readFile(reviewPath, 'utf8');
  const data = JSON.parse(content);
  return data.resources.filter((r) => r.status === 'approved');
}
