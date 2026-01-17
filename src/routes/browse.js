/**
 * Browse Route Handler
 */

import express from 'express';
import { browse } from '../services/BrowseService.js';
import { validateUrlParameter } from '../utils/validation.js';

const router = express.Router();

/**
 * POST /browse
 * Browse a URL and extract content
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const { url, selector = 'body', extract = 'text' } = req.body;

        // Validate input
        validateUrlParameter(url);

        console.log(`[Browse] URL: "${url}", Selector: "${selector}", Extract: "${extract}"`);

        // Perform browse through request queue
        const result = await req.app.locals.requestQueue.enqueue(async () => {
            return await browse(url, selector, extract);
        });

        res.json({
            ...result,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });

    } catch (error) {
        console.error('[Browse] Error:', error);
        res.status(error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500).json({
            error: error.message.includes('required') || error.message.includes('Invalid') ? 'Bad Request' : 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

export default router;
