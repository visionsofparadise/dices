import type { Overlay } from "./models/Overlay/index.js";
import { Session } from "./models/Session/index.js";

/**
 * Encrypts data for a remote peer.
 *
 * Creates an authenticated encrypted buffer using the bounded triple ratchet protocol.
 * Initializes new ratchet sessions automatically on first message. Handles ML-KEM rotation
 * when message or time bounds are reached. Automatically fetches initiation keys from DHT
 * if needed for first message.
 *
 * This is a convenience wrapper around Session.open() and session.encrypt(). For multiple
 * operations with the same peer, use Session directly to avoid repeated session lookups.
 *
 * @param remoteNodeId - The 20-byte nodeId of the recipient
 * @param data - Plaintext data to encrypt
 * @param overlay - The DICES overlay instance
 * @returns Promise resolving to the encrypted buffer
 * @throws {DicesOverlayError} If unable to fetch initiation keys or state save fails
 *
 * @example
 * ```typescript
 * import { encrypt } from "@xkore/dices";
 *
 * const encrypted = await encrypt(recipientNodeId, messageData, overlay);
 * await transport.send(encrypted);
 * ```
 */
export const encrypt = async (remoteNodeId: Uint8Array, data: Uint8Array, overlay: Overlay): Promise<Uint8Array> => {
	const session = await Session.open(overlay, remoteNodeId);
	return session.encrypt(data);
};
