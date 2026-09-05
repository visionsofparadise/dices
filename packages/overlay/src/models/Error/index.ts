/**
 * DICES Overlay error with support for separate internal/external messages.
 *
 * Public message is shown to users/applications (should be generic for security).
 * Internal details can include sensitive information for debugging/logging.
 *
 * @example
 * ```typescript
 * // Generic public message, detailed internal info
 * throw new DicesOverlayError('Decryption failed', {
 *   internalDetails: `No local ratchet keys found for keyId: ${keyId.toString('hex')}`
 * });
 *
 * // Log internal details for debugging
 * try {
 *   // ...
 * } catch (error) {
 *   if (error instanceof DicesOverlayError) {
 *     logger.error(error.getInternalMessage());
 *   }
 * }
 * ```
 */
export class DicesOverlayError extends Error {
	/**
	 * Internal details that may contain sensitive information.
	 * Only log/display this in secure debugging contexts.
	 */
	private internalDetails?: string;

	constructor(
		message: string,
		options?: {
			internalDetails?: string;
			cause?: unknown;
		}
	) {
		super(message, { cause: options?.cause });
		this.name = 'DicesOverlayError';
		this.internalDetails = options?.internalDetails;
	}

	/**
	 * Returns the full internal message including sensitive details.
	 * Use this for logging/debugging in secure contexts only.
	 * Never expose to untrusted parties.
	 */
	getInternalMessage(): string {
		return this.internalDetails || this.message;
	}
}
