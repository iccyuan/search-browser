/**
 * Screenshot Service
 * Take screenshots of URLs
 */

import { readFileSync, unlinkSync } from 'fs';
import runAgentCommand from '../core/AgentExecutor.js';
import { generateSessionId } from '../utils/session.js';
import { withRetry } from '../utils/retry.js';
import config from '../config/index.js';

/**
 * Take a screenshot of a URL
 * @param {string} url - URL to screenshot
 * @returns {Promise<Object>} - Screenshot data (base64)
 */
export async function takeScreenshot(url) {
    const sessionId = generateSessionId();
    const tempFile = `/tmp/screenshot-${sessionId}.png`;

    try {
        await withRetry(async () => {
            // 1. Open URL
            await runAgentCommand(['--session', sessionId, 'open', url], { timeout: config.timeouts.open });

            // 2. Wait for page load
            await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: config.timeouts.wait });

            // 3. Take screenshot
            await runAgentCommand(['--session', sessionId, 'screenshot', tempFile], { timeout: config.timeouts.screenshot });
        }, 2);

        // Read and encode screenshot
        const screenshotBuffer = readFileSync(tempFile);
        const base64Screenshot = screenshotBuffer.toString('base64');

        // Cleanup temp file
        try {
            unlinkSync(tempFile);
        } catch (error) {
            console.warn('[Screenshot] Failed to delete temp file:', error.message);
        }

        return {
            url,
            screenshot: base64Screenshot
        };
    } finally {
        try {
            await runAgentCommand(['--session', sessionId, 'close'], { timeout: config.timeouts.close });
        } catch (error) {
            console.warn('[Screenshot] Failed to close session:', error.message);
        }
    }
}

export default takeScreenshot;
