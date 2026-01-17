/**
 * Configuration Module
 * Centralized configuration management for the application
 */

export const config = {
    // Server configuration
    port: process.env.PORT || 5000,

    // Timeout settings (in milliseconds)
    timeouts: {
        command: 30000,
        open: 15000,
        wait: 20000,
        extract: 10000,
        screenshot: 10000,
        close: 5000
    },

    // Retry configuration
    retry: {
        maxAttempts: 3,
        baseDelay: 1000
    },

    // Buffer configuration
    maxBuffer: 10 * 1024 * 1024, // 10MB

    // Search configuration
    search: {
        defaultMaxResults: 5,
        relevanceThreshold: 0.5,
        minKeywordLength: 2
    }
};

export default config;
