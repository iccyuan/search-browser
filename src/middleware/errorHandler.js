/**
 * Error Handler Middleware
 * Centralized error handling
 */

/**
 * Error handling middleware
 */
export function errorHandler(err, req, res, next) {
    console.error('[Server] Unhandled error:', err);

    res.status(err.status || 500).json({
        error: err.status === 400 ? 'Bad Request' : 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
    });
}

export default errorHandler;
