/**
 * Routes Index
 * Aggregates all route handlers
 */

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import searchRouter from './search.js';
import browseRouter from './browse.js';
import screenshotRouter from './screenshot.js';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Load OpenAPI specification
const openapiSpec = JSON.parse(
    readFileSync(join(__dirname, '../../openapi.json'), 'utf8')
);
openapiSpec.servers[0].url = `http://localhost:${config.port}`;

/**
 * GET /openapi.json
 * Return OpenAPI specification
 */
router.get('/openapi.json', (req, res) => {
    res.json(openapiSpec);
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'agent-browser-openapi',
        version: openapiSpec.info.version,
        queue: req.app.locals.requestQueue.getQueueLength()
    });
});

// Mount route handlers
router.use('/search', searchRouter);
router.use('/browse', browseRouter);
router.use('/screenshot', screenshotRouter);

export default router;
