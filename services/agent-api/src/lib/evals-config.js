/**
 * Evals Configuration
 *
 * Shared clients and configuration for the evals framework.
 */

import OpenAI from 'openai';
import process from 'node:process';

import { getSupabaseAdminClient } from '../clients/supabase.js';

export function getEvalsSupabase() {
  return getSupabaseAdminClient();
}

/** @type {import('openai').default | null} */
let openai = null;

export function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}
