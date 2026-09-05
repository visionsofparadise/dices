import type { Overlay } from "./models/Overlay/index.js";
import { Session } from "./models/Session/index.js";
import { EnvelopeCodec } from "./models/Envelope/Codec.js";

/**
 * Decrypts data from a remote peer.
 *
 * Verifies signature FIRST (before any database operations), then initializes ratchet state
 * if needed (for first message), handles DH ratchet updates, decrypts the message, and
 * persists updated ratchet state.
 *
 * Security: Signature verification occurs before database lookups to fail fast on invalid
 * envelopes and prevent database read amplification attacks.
 *
 * This is a convenience wrapper around Session.open() and session.decrypt(). For multiple
 * operations with the same peer, use Session directly to avoid repeated session lookups.
 *
 * @param buffer - The encrypted buffer to decrypt
 * @param overlay - The DICES overlay instance
 * @returns Promise resolving to the decrypted plaintext data
 * @throws {DicesOverlayError} If signature verification fails, ratchet state invalid, or decryption fails
 *
 * @example
 * ```typescript
 * import { decrypt } from "@xkore/dices";
 *
 * const data = await decrypt(encryptedBuffer, overlay);
 * console.log("Received:", new TextDecoder().decode(data));
 * ```
 */
export const decrypt = async (buffer: Uint8Array, overlay: Overlay): Promise<Uint8Array> => {
	// Decode envelope to get remoteNodeId (for session lookup)
	// Full verification happens inside session.decrypt()
	const envelopeInstance = EnvelopeCodec.decode(buffer);
	const remoteNodeId = envelopeInstance.nodeId;

	const session = await Session.open(overlay, remoteNodeId);
	return session.decrypt(buffer);
};
