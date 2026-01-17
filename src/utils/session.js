/**
 * Session Utilities
 * Session ID generation and management
 */

/**
 * Generate unique session ID
 * @returns {string} - Unique session identifier
 */
export function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default generateSessionId;
