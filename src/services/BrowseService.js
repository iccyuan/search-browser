/**
 * Browse Service
 * Browse URLs and extract content
 */

import runAgentCommand from '../core/AgentExecutor.js';
import { generateSessionId } from '../utils/session.js';
import { withRetry } from '../utils/retry.js';
import config from '../config/index.js';

/**
 * Browse a URL and extract content
 * @param {string} url - URL to browse
 * @param {string} selector - CSS selector for content extraction
 * @param {string} extract - Type of content to extract ('text' or 'html')
 * @returns {Promise<Object>} - Extracted content
 */
export async function browse(url, selector = 'body', extract = 'text') {
    const sessionId = generateSessionId();

    try {
        const content = await withRetry(async () => {
            // 1. Open URL
            await runAgentCommand(['--session', sessionId, 'open', url], { timeout: config.timeouts.open });

            // 2. Wait for page load
            await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: config.timeouts.wait });

            // 3. Extract content
            const command = extract === 'html' ? 'get html' : 'get text';
            return await runAgentCommand(['--session', sessionId, ...command.split(' '), selector], { timeout: config.timeouts.extract });
        }, 2);

        return {
            url,
            content: { [extract]: content.trim() }
        };
    } finally {
        try {
            await runAgentCommand(['--session', sessionId, 'close'], { timeout: config.timeouts.close });
        } catch (error) {
            console.warn('[Browse] Failed to close session:', error.message);
        }
    }
}

export default browse;
