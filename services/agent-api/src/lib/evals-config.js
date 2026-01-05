/**
 * Evals Configuration
 *
 * Shared clients and configuration for the evals framework.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

let openai = null;

export function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}
