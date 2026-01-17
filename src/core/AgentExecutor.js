/**
 * Agent Executor Module
 * Safe execution of agent-browser commands
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config/index.js';

const execFilePromise = promisify(execFile);

/**
 * Execute agent-browser command safely (no shell injection)
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Command timeout in ms
 * @returns {Promise<string>} - Command stdout
 */
export async function runAgentCommand(args, options = {}) {
    const { timeout = config.timeouts.command } = options;

    console.log('[Agent] Executing:', 'agent-browser', args.join(' '));

    try {
        const { stdout, stderr } = await execFilePromise(
            'agent-browser',
            args,
            {
                timeout,
                maxBuffer: config.maxBuffer,
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

export default runAgentCommand;
