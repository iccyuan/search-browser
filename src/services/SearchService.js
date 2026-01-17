/**
 * Search Service
 * Intelligent search functionality with optimized workflow
 */

import runAgentCommand from '../core/AgentExecutor.js';
import { generateSessionId } from '../utils/session.js';
import { validateUrl } from '../utils/validation.js';
import { withRetry } from '../utils/retry.js';
import { extractLinksFromHtml, parseSearchResults, checkRelevance } from '../utils/parser.js';
import config from '../config/index.js';

/**
 * Generate summary from all search results
 * @param {string} query - Search query
 * @param {Array} results - Array of search results
 * @returns {string} - Summary text
 */
function generateSummary(query, results) {
    if (results.length === 0) {
        return `No relevant results found for query: "${query}"`;
    }

    const summary = [
        `Search Summary for: "${query}"`,
        `Found ${results.length} relevant result(s):\n`
    ];

    results.forEach((result, index) => {
        summary.push(`${index + 1}. ${result.title}`);
        summary.push(`   URL: ${result.url}`);
        summary.push(`   Relevance: ${result.relevance}`);
        summary.push(`   Preview: ${result.snippet.substring(0, 150)}...`);
        summary.push('');
    });

    return summary.join('\n');
}

/**
 * Perform intelligent search with optimized workflow
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Object>} - Search results with summary
 */
export async function search(query, maxResults = config.search.defaultMaxResults) {
    const sessionId = generateSessionId();
    const results = [];
    let links = [];

    try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        validateUrl(searchUrl);

        // Step 1: 打开 Google 并用关键字搜索
        console.log('[Search] Step 1: Opening Google and searching with keywords...');
        await withRetry(async () => {
            await runAgentCommand(['--session', sessionId, 'open', searchUrl], { timeout: config.timeouts.open });
        }, 2);

        // Step 2: 智能等待搜索结果
        console.log('[Search] Step 2: Waiting for search results to load...');
        await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: config.timeouts.wait });

        // Step 3: 提取搜索结果返回的链接
        console.log('[Search] Step 3: Extracting search result links...');

        // Method 1: Try to get links directly using CSS selectors
        try {
            console.log('[Search] Trying direct link extraction with CSS selectors...');

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
                        { timeout: config.timeouts.extract }
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
            const snapshot = await runAgentCommand(['--session', sessionId, 'snapshot'], { timeout: config.timeouts.extract });
            links = parseSearchResults(snapshot, maxResults);
        }

        console.log(`[Search] Found ${links.length} result links`);

        // Steps 4-8: 依次点击链接、等待加载、提取内容、检查相关性
        for (let i = 0; i < Math.min(links.length, maxResults * 2); i++) {
            const link = links[i];

            // Step 4: 点击第一个/下一个链接
            console.log(`[Search] Step 4.${i + 1}: Clicking link ${i + 1}: ${link.url}...`);

            try {
                // Navigate to the result page (using open instead of click for reliability)
                await runAgentCommand(['--session', sessionId, 'open', link.url], { timeout: config.timeouts.open });

                // Step 5: 智能等待页面加载完成
                console.log(`[Search] Step 5.${i + 1}: Waiting for page to load...`);
                await runAgentCommand(['--session', sessionId, 'wait', '--load', 'networkidle'], { timeout: config.timeouts.wait });

                // Step 6: 提取页面内容
                console.log(`[Search] Step 6.${i + 1}: Extracting page content...`);
                const title = await runAgentCommand(['--session', sessionId, 'get', 'title'], { timeout: config.timeouts.extract }).catch(() => link.title);
                const content = await runAgentCommand(['--session', sessionId, 'get', 'text', 'body'], { timeout: config.timeouts.extract });

                // Extract first 500 characters as snippet
                const snippet = content.trim().substring(0, 500);

                // Step 7: 识别页面内容是否和搜索结果相关
                console.log(`[Search] Step 7.${i + 1}: Checking content relevance...`);
                const isRelevant = checkRelevance(query, content);

                if (isRelevant) {
                    results.push({
                        title: title.trim() || link.title,
                        url: link.url,
                        snippet: snippet,
                        relevance: 'high',
                        contentLength: content.length
                    });
                    console.log(`[Search] ✓ Result ${i + 1} is relevant (${content.length} chars)`);
                } else {
                    console.log(`[Search] ✗ Result ${i + 1} not relevant, skipping`);
                }

                // Step 8: 直到达到设置的最大搜索结果数
                if (results.length >= maxResults) {
                    console.log(`[Search] Reached max results (${maxResults}), stopping`);
                    break;
                }
            } catch (error) {
                console.warn(`[Search] Failed to process result ${i + 1}:`, error.message);
                // Continue with next result
            }
        }

        // Step 9: 总结所有搜索结果
        console.log('[Search] Step 9: Generating summary of all results...');
        const summary = generateSummary(query, results);

        // Step 10: 返回结果
        console.log('[Search] Step 10: Returning results');
        return {
            query,
            results,
            totalFound: links.length,
            relevantCount: results.length,
            summary
        };
    } finally {
        // Always cleanup session
        try {
            await runAgentCommand(['--session', sessionId, 'close'], { timeout: config.timeouts.close });
        } catch (error) {
            console.warn('[Search] Failed to close session:', error.message);
        }
    }
}

export default search;
