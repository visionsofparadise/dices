/**
 * Retries a database operation with exponential backoff for transient failures.
 *
 * Useful for handling temporary database issues like locks, I/O errors, etc.
 * Does NOT retry for permanent errors like validation failures or not found.
 *
 * @param operation - The database operation to retry
 * @param options - Retry configuration
 * @returns Result of the operation
 * @throws Error if all retries exhausted or non-retryable error
 *
 * @example
 * ```typescript
 * const value = await retryDatabaseOperation(
 *   () => database.get(key),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export const retryDatabaseOperation = async <T>(
	operation: () => Promise<T>,
	options: {
		maxRetries?: number;
		initialDelayMs?: number;
		maxDelayMs?: number;
	} = {}
): Promise<T> => {
	const maxRetries = options.maxRetries ?? 3;
	const initialDelayMs = options.initialDelayMs ?? 100;
	const maxDelayMs = options.maxDelayMs ?? 2000;

	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error: any) {
			lastError = error;

			// Don't retry for these errors (permanent failures)
			const nonRetryableErrors = [
				'LEVEL_NOT_FOUND',
				'LEVEL_INVALID_KEY',
				'LEVEL_INVALID_VALUE',
			];

			if (error.code && nonRetryableErrors.includes(error.code)) {
				throw error;
			}

			// Don't retry on last attempt
			if (attempt === maxRetries) {
				throw error;
			}

			// Exponential backoff with jitter
			const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
			const jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter
			const delay = baseDelay + jitter;

			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	throw lastError;
};
