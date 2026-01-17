/**
 * Production-Grade Agent Browser OpenAPI Server
 * Modular Architecture
 * 
 * Features:
 * - Request queuing to prevent concurrent conflicts
 * - Session management with proper cleanup
 * - Retry mechanism with exponential backoff
 * - Proper page load waiting (networkidle)
 * - Safe command execution (no shell injection)
 * - Detailed error logging
 * - Resource cleanup in finally blocks
 * - Cross-platform compatibility
 * 
 * Installation:
 *   npm install express cors
 *   npm install -g agent-browser
 * 
 * Usage:
 *   node src/server.js
 */

import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import RequestQueue from './core/RequestQueue.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Initialize request queue and make it available to routes
const requestQueue = new RequestQueue();
app.locals.requestQueue = requestQueue;

// Middleware
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Agent Browser OpenAPI Server running on http://localhost:${config.port}`);
    console.log(`📋 OpenAPI Spec: http://localhost:${config.port}/openapi.json`);
    console.log(`\n✨ Features:`);
    console.log(`   ✅ Request queuing (prevents conflicts)`);
    console.log(`   ✅ Session management (proper cleanup)`);
    console.log(`   ✅ Retry mechanism (${config.retry.maxAttempts} retries with backoff)`);
    console.log(`   ✅ Network idle waiting (proper page load)`);
    console.log(`   ✅ Safe command execution (no shell injection)`);
    console.log(`   ✅ Modular architecture (easy to maintain)`);
    console.log(`\n🔧 To use in Open WebUI:`);
    console.log(`   1. Go to Workspace -> Tools`);
    console.log(`   2. Click "Import Tool"`);
    console.log(`   3. Enter URL: http://localhost:${config.port}/openapi.json`);
    console.log(`   (Use http://host.docker.internal:${config.port}/openapi.json if Open WebUI is in Docker)\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    // TODO: Close all active sessions
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    // TODO: Close all active sessions
    process.exit(0);
});
