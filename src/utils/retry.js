/**
 * Retry Utility
 * Retry function with exponential backoff
 */

import config from '../config/index.js';

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of the function
 */
export async function withRetry(
    fn,
    maxRetries = config.retry.maxAttempts,
    baseDelay = config.retry.baseDelay
) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }

            const delay = baseDelay * Math.pow(2, i);
            console.warn(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export default withRetry;
