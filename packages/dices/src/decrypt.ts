import type { Overlay } from "./models/Overlay/index.js";
import { computeRatchetId } from "./utilities/computeRatchetId.js";
import { EnvelopeCodec } from "./models/Envelope/Codec.js";
import { DicesOverlayError } from "./models/Error/index.js";
import { RatchetKeysItem } from "./models/RatchetKeysItem/index.js";
import { RatchetStateItem } from "./models/RatchetStateItem/index.js";

/**
 * Decrypts data from a remote peer.
 *
 * Performs signature verification, initializes ratchet state if needed (for first message),
 * handles DH ratchet updates, decrypts the message, and persists updated ratchet state.
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
	const envelopeInstance = EnvelopeCodec.decode(buffer);
	const localRatchetKeysItem = await RatchetKeysItem.get(RatchetKeysItem.keyOf({ keyId: envelopeInstance.keyId }), overlay);

	if (!localRatchetKeysItem) {
		throw new DicesOverlayError("No local ratchet keys found for keyId");
	}

	const ratchetId = computeRatchetId(overlay.keys.nodeId, envelopeInstance.nodeId);

	let ratchetState = await RatchetStateItem.get(RatchetStateItem.keyOf({ ratchetId }), overlay);

	// Explicit initialization for first message from this peer
	if (!ratchetState) {
		if (!envelopeInstance.kemCiphertext) {
			throw new DicesOverlayError("Cannot initialize ratchet: missing kemCiphertext in first message");
		}

		ratchetState = RatchetStateItem.initializeAsResponder(envelopeInstance, overlay.keys.nodeId, localRatchetKeysItem, envelopeInstance.nodeId);
	}

	// Decrypt message
	const data = envelopeInstance.decrypt(envelopeInstance.nodeId, ratchetState);

	await ratchetState.put(overlay);

	return data;
};
