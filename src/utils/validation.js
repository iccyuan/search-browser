/**
 * Validation Utilities
 * Input validation and sanitization functions
 */

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @throws {Error} - If URL is invalid
 * @returns {boolean} - True if valid
 */
export function validateUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Only HTTP/HTTPS protocols are allowed');
        }
        return true;
    } catch (error) {
        throw new Error(`Invalid URL: ${error.message}`);
    }
}

/**
 * Validate search query
 * @param {*} query - Query to validate
 * @throws {Error} - If query is invalid
 * @returns {boolean} - True if valid
 */
export function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
    }
    if (query.trim().length === 0) {
        throw new Error('Query cannot be empty');
    }
    return true;
}

/**
 * Validate URL parameter from request body
 * @param {*} url - URL to validate
 * @throws {Error} - If URL is invalid
 * @returns {boolean} - True if valid
 */
export function validateUrlParameter(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL parameter is required and must be a string');
    }
    return validateUrl(url);
}
