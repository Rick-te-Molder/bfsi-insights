/**
 * POST /api/agents/enrich-single-step
 * Single-step re-enrichment using orchestrator pattern.
 * Agents return results to orchestrator; orchestrator handles transitions.
 */

import express from 'express';
import { enrichSingleStepHandler } from './enrich-single-step.handler.js';

const router = express.Router();

router.post('/enrich-single-step', enrichSingleStepHandler);

export { buildThumbnailPayload } from './enrich-single-step.logic.js';

export default router;
