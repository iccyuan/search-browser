#!/usr/bin/env node

/**
 * Test script for search link extraction
 * Tests the optimized snapshot + refs approach
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

async function runCommand(args) {
    console.log('\n$ agent-browser', args.join(' '));
    try {
        const { stdout, stderr } = await execFilePromise('agent-browser', args, {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024
        });
        if (stderr) console.error('stderr:', stderr);
        return stdout;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

async function testSearchExtraction() {
    const sessionId = `test-${Date.now()}`;

    try {
        console.log('='.repeat(80));
        console.log('Testing Search Link Extraction with Snapshot + Refs');
        console.log('='.repeat(80));

        // Step 1: Open Google search
        console.log('\n[Step 1] Opening Google search...');
        await runCommand(['--session', sessionId, 'open', 'https://www.google.com/search?q=Node.js']);

        // Step 2: Wait for page load
        console.log('\n[Step 2] Waiting for page to load...');
        await runCommand(['--session', sessionId, 'wait', '--load', 'networkidle']);

        // Step 3a: Try interactive snapshot
        console.log('\n[Step 3a] Getting interactive snapshot (-i)...');
        const interactiveSnapshot = await runCommand(['--session', sessionId, 'snapshot', '-i']);
        console.log('\n--- Interactive Snapshot (first 2000 chars) ---');
        console.log(interactiveSnapshot.substring(0, 2000));

        // Parse for links
        const links = [];
        const lines = interactiveSnapshot.split('\n');
        for (const line of lines) {
            if (line.includes('link') && line.includes('[ref=')) {
                const refMatch = line.match(/\[ref=([^\]]+)\]/);
                const textMatch = line.match(/"([^"]+)"/);
                const urlMatch = line.match(/https?:\/\/[^\s]+/);

                if (refMatch && urlMatch) {
                    const ref = refMatch[1];
                    const text = textMatch ? textMatch[1] : '';
                    const url = urlMatch[0];

                    // Filter Google URLs
                    if (!url.includes('google.com/search') &&
                        !url.includes('accounts.google') &&
                        !url.includes('support.google')) {
                        links.push({ ref, text, url });
                        console.log(`\n✓ Found link: [${ref}] "${text.substring(0, 50)}" -> ${url.substring(0, 60)}`);
                    }
                }
            }
        }

        console.log(`\n[Result] Found ${links.length} search result links`);

        if (links.length > 0) {
            // Test clicking first link
            console.log(`\n[Step 4] Testing click on first link using ref @${links[0].ref}...`);
            try {
                await runCommand(['--session', sessionId, 'click', `@${links[0].ref}`]);
                console.log('✓ Click successful');

                await runCommand(['--session', sessionId, 'wait', '--load', 'networkidle']);
                const title = await runCommand(['--session', sessionId, 'get', 'title']);
                console.log(`✓ Navigated to: ${title.trim()}`);
            } catch (error) {
                console.error('✗ Click failed:', error.message);
            }
        } else {
            console.log('\n⚠ No links found. Trying compact snapshot...');

            // Step 3b: Try compact snapshot
            console.log('\n[Step 3b] Getting compact snapshot (-c)...');
            const compactSnapshot = await runCommand(['--session', sessionId, 'snapshot', '-c']);
            console.log('\n--- Compact Snapshot (first 2000 chars) ---');
            console.log(compactSnapshot.substring(0, 2000));
        }

    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Closing session...');
        try {
            await runCommand(['--session', sessionId, 'close']);
            console.log('✓ Session closed');
        } catch (error) {
            console.error('✗ Failed to close session:', error.message);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Test completed');
    console.log('='.repeat(80));
}

// Run test
testSearchExtraction().catch(console.error);
