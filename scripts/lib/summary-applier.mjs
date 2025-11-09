#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

export async function applySummaries(reviewPath, itemsDir) {
  const reviewContent = await fs.readFile(reviewPath, 'utf8');
  const reviewData = JSON.parse(reviewContent);

  const approved = reviewData.resources.filter((r) => r.status === 'approved');
  const updated = [];
  const errors = [];

  for (const item of approved) {
    try {
      const filePath = path.join(itemsDir, item.filename);
      const resourceContent = await fs.readFile(filePath, 'utf8');
      const resource = JSON.parse(resourceContent);

      // Add new summary fields
      resource.summary_short = item.summaries.summary_short;
      resource.summary_medium = item.summaries.summary_medium;
      resource.summary_long = item.summaries.summary_long;

      // Write back
      await fs.writeFile(filePath, JSON.stringify(resource, null, 2) + '\n');
      updated.push(item.filename);
    } catch (error) {
      errors.push({
        filename: item.filename,
        error: error.message,
      });
    }
  }

  return { updated, errors };
}
