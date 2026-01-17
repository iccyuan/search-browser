/**
 * Parser Utilities
 * HTML and snapshot parsing functions
 */

import config from '../config/index.js';

/**
 * Extract links from HTML content
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
 * @param {string} snapshot - Accessibility tree snapshot
 * @param {number} maxResults - Maximum number of results
 * @returns {Array<{url: string, title: string}>} - Parsed links
 */
export function parseSearchResults(snapshot, maxResults) {
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
