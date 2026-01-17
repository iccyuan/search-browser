/**
 * Request Queue Module
 * Prevents concurrent browser conflicts by processing requests sequentially
 */

export class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    /**
     * Add a task to the queue and return a promise that resolves when the task completes
     * @param {Function} task - Async function to execute
     * @returns {Promise} - Resolves with task result or rejects with error
     */
    async enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    /**
     * Process the next task in the queue
     */
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

    /**
     * Get current queue length
     * @returns {number}
     */
    getQueueLength() {
        return this.queue.length;
    }
}

export default RequestQueue;
