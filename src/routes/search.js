/**
 * Search Route Handler
 */

import express from 'express';
import { search } from '../services/SearchService.js';
import { validateSearchQuery } from '../utils/validation.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * POST /search
 * Intelligent search: parses Google results, visits each page, extracts content
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, maxResults = config.search.defaultMaxResults } = req.body;

        // Validate input
        validateSearchQuery(query);

        console.log(`[Search] Query: "${query}", Max Results: ${maxResults}`);

        // Perform search through request queue
        const result = await req.app.locals.requestQueue.enqueue(async () => {
            return await search(query, maxResults);
        });

        res.json({
            ...result,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });

    } catch (error) {
        console.error('[Search] Error:', error);
        res.status(error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500).json({
            error: error.message.includes('required') || error.message.includes('Invalid') ? 'Bad Request' : 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

export default router;
