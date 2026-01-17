/**
 * Parser Utilities
 * HTML and snapshot parsing functions optimized for agent-browser refs
 */

import config from '../config/index.js';

/**
 * Parse snapshot and extract link refs
 * Uses agent-browser's accessibility tree with refs
 * @param {string} snapshot - Accessibility tree snapshot
 * @param {number} maxResults - Maximum number of results
 * @returns {Array<{ref: string, text: string, url: string}>} - Extracted link refs
 */
export function parseSnapshotRefs(snapshot, maxResults) {
    const links = [];

    try {
        console.log('[Parser] Parsing snapshot for link refs (length: ' + snapshot.length + ' chars)');

        const lines = snapshot.split('\n');
        console.log('[Parser] Total lines in snapshot: ' + lines.length);

        // Parse accessibility tree format:
        // - link "Text" [ref=e1] url
        // The format is: - <role> "<text>" [ref=<ref>] <url>

        for (const line of lines) {
            // Look for lines that contain "link" role and a ref
            if (line.includes('link') && line.includes('[ref=')) {
                // Extract ref
                const refMatch = line.match(/\[ref=([^\]]+)\]/);
                if (!refMatch) continue;

                const ref = refMatch[1];

                // Extract text (between quotes)
                const textMatch = line.match(/"([^"]+)"/);
                const text = textMatch ? textMatch[1] : '';

                // Extract URL (after the ref, typically at the end)
                // Look for http/https URLs
                const urlMatch = line.match(/https?:\/\/[^\s]+/);
                const url = urlMatch ? urlMatch[0] : '';

                // Filter out Google's own URLs
                if (url &&
                    !url.includes('google.com/search') &&
                    !url.includes('accounts.google') &&
                    !url.includes('support.google') &&
                    !url.includes('policies.google') &&
                    !url.includes('webcache.googleusercontent.com') &&
                    !url.includes('youtube.com/watch') &&
                    !url.startsWith('https://www.google.') &&
                    url.length > 10 &&
                    !links.some(l => l.url === url)) {

                    links.push({ ref, text, url });
                    console.log(`[Parser] Found link ${links.length}: [${ref}] "${text.substring(0, 50)}" -> ${url.substring(0, 60)}`);

                    if (links.length >= maxResults * 2) {
                        break;
                    }
                }
            }
        }

        console.log(`[Parser] Parsing complete: extracted ${links.length} link refs`);

        // Debug: If no links found, show sample of snapshot
        if (links.length === 0) {
            console.log('[Parser] WARNING: No links found! Sample snapshot (first 1000 chars):');
            console.log(snapshot.substring(0, 1000));
        }
    } catch (error) {
        console.error('[Parser] Failed to parse snapshot:', error.message);
    }

    return links;
}

/**
 * Extract links from HTML content (fallback method)
 * @param {string} html - HTML content
 * @param {number} maxResults - Maximum number of results to extract
 * @returns {Array<{url: string, title: string}>} - Extracted links
 */
export function extractLinksFromHtml(html, maxResults) {
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
                const urlIndex = html.indexOf(match[0]);
                const afterUrl = html.substring(urlIndex);
                const titleMatch = afterUrl.match(/>([^<]+)</);
                const title = titleMatch ? titleMatch[1].trim() : url;

                links.push({ url, title });
                console.log(`[Parser] Extracted: ${title.substring(0, 50)} -> ${url.substring(0, 60)}`);

                if (links.length >= maxResults * 2) {
                    break;
                }
            }
        }
    } catch (error) {
        console.error('[Parser] Failed to extract from HTML:', error.message);
    }

    return links;
}

/**
 * Parse search results from snapshot (legacy method)
 * @param {string} snapshot - Accessibility tree snapshot
 * @param {number} maxResults - Maximum number of results
 * @returns {Array<{url: string, title: string}>} - Parsed links
 */
export function parseSearchResults(snapshot, maxResults) {
    const links = [];

    try {
        console.log('[Parser] Parsing snapshot (length: ' + snapshot.length + ' chars)');

        const lines = snapshot.split('\n');
        console.log('[Parser] Total lines in snapshot: ' + lines.length);

        for (const line of lines) {
            const urlMatch = line.match(/https?:\/\/[^\s"'<>]+/);
            const titleMatch = line.match(/"([^"]+)"|'([^']+)'/);

            if (urlMatch) {
                const url = urlMatch[0];
                const title = titleMatch ? (titleMatch[1] || titleMatch[2] || url) : url;

                if (!url.includes('google.com') &&
                    !url.includes('accounts.google') &&
                    !url.includes('support.google') &&
                    !url.includes('policies.google') &&
                    !url.includes('youtube.com/watch') &&
                    !url.startsWith('https://www.google.') &&
                    url.length > 10 &&
                    !links.some(l => l.url === url)) {

                    links.push({ url, title });
                    console.log(`[Parser] Found link ${links.length}: ${title.substring(0, 50)} -> ${url.substring(0, 60)}`);

                    if (links.length >= maxResults * 2) {
                        break;
                    }
                }
            }
        }

        console.log(`[Parser] Parsing complete: extracted ${links.length} links`);

        if (links.length === 0) {
            console.log('[Parser] WARNING: No links found! Sample snapshot (first 500 chars):');
            console.log(snapshot.substring(0, 500));
        }
    } catch (error) {
        console.error('[Parser] Failed to parse snapshot:', error.message);
    }

    return links;
}

/**
 * Check if content is relevant to query
 * @param {string} query - Search query
 * @param {string} content - Page content
 * @returns {boolean} - True if content is relevant
 */
export function checkRelevance(query, content) {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Split query into keywords
    const keywords = lowerQuery.split(/\s+/).filter(k => k.length > config.search.minKeywordLength);

    // Count how many keywords appear in content
    let matchCount = 0;
    for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
            matchCount++;
        }
    }

    // Consider relevant if at least 50% of keywords match
    const relevanceThreshold = Math.max(1, Math.ceil(keywords.length * config.search.relevanceThreshold));
    return matchCount >= relevanceThreshold;
}
