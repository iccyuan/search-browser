/**
 * Screenshot Route Handler
 */

import express from 'express';
import { takeScreenshot } from '../services/ScreenshotService.js';
import { validateUrlParameter } from '../utils/validation.js';

const router = express.Router();

/**
 * POST /screenshot
 * Take a screenshot of a URL
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const { url } = req.body;

        // Validate input
        validateUrlParameter(url);

        console.log(`[Screenshot] URL: "${url}"`);

        // Take screenshot through request queue
        const result = await req.app.locals.requestQueue.enqueue(async () => {
            return await takeScreenshot(url);
        });

        res.json({
            ...result,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });

    } catch (error) {
        console.error('[Screenshot] Error:', error);
        res.status(error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500).json({
            error: error.message.includes('required') || error.message.includes('Invalid') ? 'Bad Request' : 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

export default router;
