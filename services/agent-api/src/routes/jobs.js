/**
 * Jobs API routes
 * Background job triggers for orchestration
 */

import express from 'express';
import retryRouter from './jobs/retry.js';

const router = express.Router();

router.use('/', retryRouter);

export default router;
