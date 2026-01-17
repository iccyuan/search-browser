/**
 * Production-Grade Agent Browser OpenAPI Server
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
 *   node openapi-server.js
 */

import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFilePromise = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 5000;

// Load OpenAPI specification
const openapiSpec = JSON.parse(
    readFileSync(join(__dirname, 'openapi.json'), 'utf8')
);
openapiSpec.servers[0].url = `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// Request Queue - Prevents concurrent browser conflicts
// ============================================================================

class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const { task, resolve, reject } = this.queue.shift();

        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process(); // Process next task
        }
    }
}

const requestQueue = new RequestQueue();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Execute agent-browser command safely (no shell injection)
 */
async function runAgentCommand(args, options = {}) {
    const { timeout = 30000 } = options;

    console.log('[Agent] Executing:', 'agent-browser', args.join(' '));

    try {
        const { stdout, stderr } = await execFilePromise(
            'agent-browser',
            args,
            {
                timeout,
                maxBuffer: 10 * 1024 * 1024,
                env: { ...process.env }
            }
        );

        if (stderr) {
            console.warn('[Agent] stderr:', stderr);
        }

        return stdout;
    } catch (error) {
        console.error('[Agent] Command failed:', {
            args,
            error: error.message,
            code: error.code
        });
        throw error;
    }
}

/**
 * Retry function with exponential backoff
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
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

/**
 * Validate URL
 */
function validateUrl(url) {
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
 * Generate unique session ID
 */
function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// API Endpoints
// ============================================================================

app.get('/openapi.json', (req, res) => {
    res.json(openapiSpec);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'agent-browser-openapi',
        version: openapiSpec.info.version,
        queue: requestQueue.queue.length
    });
});

/**
 * POST /search
 * Intelligent search: parses Google results, visits each page, extracts content
 */
app.post('/search', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, maxResults = 5 } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Query parameter is required and must be a string'
            });
        }

        console.log(`[Search] Query: "${query}", Max Results: ${maxResults}`);

        const result = await requestQueue.enqueue(async () => {
            const sessionId = generateSessionId();
            const results = [];

            try {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                validateUrl(searchUrl);

                // Step 1: Open Google search page
                console.log('[Search] Step 1: Opening search page...');
                await withRetry(async () => {
                    await runAgentCommand(['--session', sessionId, 'open', searchUrl], { timeout: 15000 });
                    await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: 20000 });
                }, 2);

                // Step 2: Extract search result links using multiple methods
                console.log('[Search] Step 2: Extracting search result links...');

                // Method 1: Try to get links directly using CSS selectors
                let links = [];
                try {
                    console.log('[Search] Trying direct link extraction with CSS selectors...');

                    // Try to extract search result links using a CSS selector
                    // Google search results typically use these selectors
                    const selectors = [
                        'div.g a[href]',           // Standard result links
                        'a[href^="http"]',         // Any http links
                        'h3 a',                     // Links in h3 headers
                    ];

                    for (const selector of selectors) {
                        try {
                            const linksHtml = await runAgentCommand(
                                ['--session', sessionId, 'get', 'html', selector],
                                { timeout: 10000 }
                            );

                            // Extract URLs from the HTML
                            const extractedLinks = extractLinksFromHtml(linksHtml, maxResults);
                            if (extractedLinks.length > 0) {
                                links = extractedLinks;
                                console.log(`[Search] Extracted ${links.length} links using selector: ${selector}`);
                                break;
                            }
                        } catch (err) {
                            console.log(`[Search] Selector ${selector} failed, trying next...`);
                        }
                    }
                } catch (error) {
                    console.warn('[Search] Direct extraction failed:', error.message);
                }

                // Method 2: Fallback to snapshot parsing
                if (links.length === 0) {
                    console.log('[Search] Falling back to snapshot parsing...');
                    const snapshot = await runAgentCommand(['--session', sessionId, 'snapshot'], { timeout: 10000 });
                    links = parseSearchResults(snapshot, maxResults);
                }

                console.log(`[Search] Found ${links.length} result links`);

                // Step 3: Visit each result page and extract content
                for (let i = 0; i < Math.min(links.length, maxResults); i++) {
                    const link = links[i];
                    console.log(`[Search] Step 3.${i + 1}: Visiting ${link.url}...`);

                    try {
                        // Visit the result page
                        await runAgentCommand(['--session', sessionId, 'open', link.url], { timeout: 15000 });
                        await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: 20000 });

                        // Extract page content
                        const title = await runAgentCommand(['--session', sessionId, 'get', 'title'], { timeout: 5000 }).catch(() => link.title);
                        const content = await runAgentCommand(['--session', sessionId, 'get', 'text', 'body'], { timeout: 10000 });

                        // Extract first 500 characters as snippet
                        const snippet = content.trim().substring(0, 500);

                        // Check if content is relevant (simple keyword matching)
                        const isRelevant = checkRelevance(query, content);

                        if (isRelevant) {
                            results.push({
                                title: title.trim() || link.title,
                                url: link.url,
                                snippet: snippet,
                                relevance: 'high'
                            });
                            console.log(`[Search] ✓ Result ${i + 1} is relevant`);
                        } else {
                            console.log(`[Search] ✗ Result ${i + 1} not relevant, skipping`);
                        }

                        // Stop if we have enough relevant results
                        if (results.length >= maxResults) {
                            console.log(`[Search] Reached max results (${maxResults}), stopping`);
                            break;
                        }
                    } catch (error) {
                        console.warn(`[Search] Failed to process result ${i + 1}:`, error.message);
                        // Continue with next result
                    }
                }

                return {
                    query,
                    results,
                    totalFound: links.length,
                    timestamp: new Date().toISOString(),
                    duration: Date.now() - startTime
                };
            } finally {
                // Always cleanup session
                try {
                    await runAgentCommand(['--session', sessionId, 'close'], { timeout: 5000 });
                } catch (error) {
                    console.warn('[Search] Failed to close session:', error.message);
                }
            }
        });

        res.json(result);

    } catch (error) {
        console.error('[Search] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

/**
 * Extract links from HTML content
 */
function extractLinksFromHtml(html, maxResults) {
    const links = [];

    try {
        // Extract all href attributes
        const hrefRegex = /href=["']([^"']+)["']/gi;
        let match;

        while ((match = hrefRegex.exec(html)) !== null) {
            const url = match[1];

            // Filter valid URLs
            if (url.startsWith('http') &&
                !url.includes('google.com') &&
                !url.includes('accounts.google') &&
                !url.includes('support.google') &&
                !url.includes('policies.google') &&
                !url.includes('webcache.googleusercontent.com') &&
                !links.some(l => l.url === url)) {

                // Try to extract title from surrounding text
                // Look for text between > and <
                const urlIndex = html.indexOf(match[0]);
                const afterUrl = html.substring(urlIndex);
                const titleMatch = afterUrl.match(/>([^<]+)</);
                const title = titleMatch ? titleMatch[1].trim() : url;

                links.push({ url, title });
                console.log(`[Search] Extracted: ${title.substring(0, 50)} -> ${url.substring(0, 60)}`);

                if (links.length >= maxResults * 2) {
                    break;
                }
            }
        }
    } catch (error) {
        console.error('[Search] Failed to extract from HTML:', error.message);
    }

    return links;
}

/**
 * Parse search results from snapshot
 */
function parseSearchResults(snapshot, maxResults) {
    const links = [];

    try {
        console.log('[Search] Parsing snapshot (length: ' + snapshot.length + ' chars)');

        // Parse the accessibility tree snapshot
        // Looking for links that are likely search results
        const lines = snapshot.split('\n');
        console.log('[Search] Total lines in snapshot: ' + lines.length);

        // Strategy 1: Look for standard link format with quotes and URLs
        for (const line of lines) {
            // Try multiple regex patterns for different formats

            // Pattern 1: Standard format - @ref "text" url or "text" url
            const urlMatch = line.match(/https?:\/\/[^\s"'<>]+/);
            const titleMatch = line.match(/"([^"]+)"|'([^']+)'/);

            if (urlMatch) {
                const url = urlMatch[0];
                const title = titleMatch ? (titleMatch[1] || titleMatch[2] || url) : url;

                // Filter out Google's own URLs and common non-result URLs
                if (!url.includes('google.com') &&
                    !url.includes('accounts.google') &&
                    !url.includes('support.google') &&
                    !url.includes('policies.google') &&
                    !url.includes('youtube.com/watch') && // Often in ads
                    !url.startsWith('https://www.google.') &&
                    url.length > 10 && // Avoid very short URLs
                    !links.some(l => l.url === url)) { // Avoid duplicates

                    links.push({ url, title });
                    console.log(`[Search] Found link ${links.length}: ${title.substring(0, 50)} -> ${url.substring(0, 60)}`);

                    if (links.length >= maxResults * 2) {
                        // Get extra links in case some fail
                        break;
                    }
                }
            }
        }

        // Strategy 2: If no links found, try to extract from link elements
        if (links.length === 0) {
            console.log('[Search] Strategy 1 failed, trying alternative extraction...');

            // Look for lines that contain "link" and a URL
            for (const line of lines) {
                if (line.toLowerCase().includes('link')) {
                    const urlMatch = line.match(/https?:\/\/[^\s"'<>]+/);
                    if (urlMatch) {
                        const url = urlMatch[0];
                        // Extract any text before the URL as title
                        const textBefore = line.substring(0, line.indexOf(url)).trim();
                        const title = textBefore || url;

                        if (!url.includes('google.com') &&
                            !links.some(l => l.url === url)) {
                            links.push({ url, title });
                            console.log(`[Search] Alt: Found link ${links.length}: ${url.substring(0, 60)}`);

                            if (links.length >= maxResults * 2) {
                                break;
                            }
                        }
                    }
                }
            }
        }

        console.log(`[Search] Parsing complete: extracted ${links.length} links`);

        // Debug: If still no links, show sample of snapshot for debugging
        if (links.length === 0) {
            console.log('[Search] WARNING: No links found! Sample snapshot (first 500 chars):');
            console.log(snapshot.substring(0, 500));
        }
    } catch (error) {
        console.error('[Search] Failed to parse snapshot:', error.message);
    }

    return links;
}

/**
 * Check if content is relevant to query
 */
function checkRelevance(query, content) {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Split query into keywords
    const keywords = lowerQuery.split(/\s+/).filter(k => k.length > 2);

    // Count how many keywords appear in content
    let matchCount = 0;
    for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
            matchCount++;
        }
    }

    // Consider relevant if at least 50% of keywords match
    const relevanceThreshold = Math.max(1, Math.ceil(keywords.length * 0.5));
    return matchCount >= relevanceThreshold;
}


/**
 * POST /browse
 * Browse a URL and extract content
 */
app.post('/browse', async (req, res) => {
    const startTime = Date.now();

    try {
        const { url, selector = 'body', extract = 'text' } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'URL parameter is required and must be a string'
            });
        }

        validateUrl(url);
        console.log(`[Browse] URL: "${url}", Selector: "${selector}", Extract: "${extract}"`);

        const result = await requestQueue.enqueue(async () => {
            const sessionId = generateSessionId();

            try {
                const content = await withRetry(async () => {
                    // 1. Open URL
                    await runAgentCommand(['--session', sessionId, 'open', url], { timeout: 15000 });

                    // 2. Wait for page load
                    await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: 20000 });

                    // 3. Extract content
                    const command = extract === 'html' ? 'get html' : 'get text';
                    return await runAgentCommand(['--session', sessionId, ...command.split(' '), selector], { timeout: 10000 });
                }, 2);

                return {
                    url,
                    content: { [extract]: content.trim() },
                    timestamp: new Date().toISOString(),
                    duration: Date.now() - startTime
                };
            } finally {
                try {
                    await runAgentCommand(['--session', sessionId, 'close'], { timeout: 5000 });
                } catch (error) {
                    console.warn('[Browse] Failed to close session:', error.message);
                }
            }
        });

        res.json(result);

    } catch (error) {
        console.error('[Browse] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

/**
 * POST /screenshot
 * Take a screenshot of a URL
 */
app.post('/screenshot', async (req, res) => {
    const startTime = Date.now();

    try {
        const { url } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'URL parameter is required and must be a string'
            });
        }

        validateUrl(url);
        console.log(`[Screenshot] URL: "${url}"`);

        const result = await requestQueue.enqueue(async () => {
            const sessionId = generateSessionId();
            const tempFile = `/tmp/screenshot-${sessionId}.png`;

            try {
                await withRetry(async () => {
                    // 1. Open URL
                    await runAgentCommand(['--session', sessionId, 'open', url], { timeout: 15000 });

                    // 2. Wait for page load
                    await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: 20000 });

                    // 3. Take screenshot
                    await runAgentCommand(['--session', sessionId, 'screenshot', tempFile], { timeout: 10000 });
                }, 2);

                // Read and encode screenshot
                const screenshotBuffer = readFileSync(tempFile);
                const base64Screenshot = screenshotBuffer.toString('base64');

                // Cleanup temp file
                const { unlinkSync } = await import('fs');
                try {
                    unlinkSync(tempFile);
                } catch (error) {
                    console.warn('[Screenshot] Failed to delete temp file:', error.message);
                }

                return {
                    url,
                    screenshot: base64Screenshot,
                    timestamp: new Date().toISOString(),
                    duration: Date.now() - startTime
                };
            } finally {
                try {
                    await runAgentCommand(['--session', sessionId, 'close'], { timeout: 5000 });
                } catch (error) {
                    console.warn('[Screenshot] Failed to close session:', error.message);
                }
            }
        });

        res.json(result);

    } catch (error) {
        console.error('[Screenshot] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            duration: Date.now() - startTime
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Agent Browser OpenAPI Server running on http://localhost:${PORT}`);
    console.log(`📋 OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
    console.log(`\n✨ Features:`);
    console.log(`   ✅ Request queuing (prevents conflicts)`);
    console.log(`   ✅ Session management (proper cleanup)`);
    console.log(`   ✅ Retry mechanism (2 retries with backoff)`);
    console.log(`   ✅ Network idle waiting (proper page load)`);
    console.log(`   ✅ Safe command execution (no shell injection)`);
    console.log(`\n🔧 To use in Open WebUI:`);
    console.log(`   1. Go to Workspace -> Tools`);
    console.log(`   2. Click "Import Tool"`);
    console.log(`   3. Enter URL: http://localhost:${PORT}/openapi.json`);
    console.log(`   (Use http://host.docker.internal:${PORT}/openapi.json if Open WebUI is in Docker)\n`);
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
