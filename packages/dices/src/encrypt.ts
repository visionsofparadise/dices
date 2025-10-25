import type { Overlay } from "./models/Overlay/index.js";
import { computeRatchetId } from "./utilities/computeRatchetId.js";
import { Envelope } from "./models/Envelope/index.js";
import { DicesOverlayError } from "./models/Error/index.js";
import { RatchetKeysPublic } from "./models/RatchetKeysItem/PublicCodec.js";
import { RatchetStateItem } from "./models/RatchetStateItem/index.js";

/**
 * Encrypts data for a remote peer.
 *
 * Creates an authenticated encrypted buffer using the bounded triple ratchet protocol.
 * Initializes new ratchet sessions automatically on first message. Handles ML-KEM rotation
 * when message or time bounds are reached. Automatically fetches initiation keys from DHT
 * if needed for first message.
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
	const ratchetId = computeRatchetId(overlay.keys.nodeId, remoteNodeId);

	let ratchetState = await RatchetStateItem.get(RatchetStateItem.keyOf({ ratchetId }), overlay);

	// If no ratchet state exists, fetch initiation keys and initialize
	if (!ratchetState) {
		let remoteInitiationKeys: RatchetKeysPublic;

		try {
			remoteInitiationKeys = await overlay.getInitiationKeys(remoteNodeId);
		} catch (error) {
			throw new DicesOverlayError("Failed to fetch initiation keys for first message", { cause: error });
		}

		const { envelope, ratchetState } = RatchetStateItem.initializeAsInitiator(overlay.keys.nodeId, remoteNodeId, remoteInitiationKeys, data, overlay.keys);

		try {
			await ratchetState.put(overlay);
		} catch (error) {
			throw new DicesOverlayError("Failed to save ratchet state", { cause: error });
		}

		return envelope.buffer;
	}

	// For existing sessions, we may need to fetch fresh initiation keys if rotation is needed
	let remoteInitiationKeys: RatchetKeysPublic | undefined;

	// Check if we need to fetch remote initiation keys for responder's first send or rotation
	if (!ratchetState.remoteKeyId) {
		try {
			remoteInitiationKeys = await overlay.getInitiationKeys(remoteNodeId);
			ratchetState.remoteKeyId = remoteInitiationKeys.keyId;
		} catch (error) {
			throw new DicesOverlayError("Failed to fetch initiation keys for session", { cause: error });
		}
	}

	const envelope = Envelope.encrypt(data, ratchetState, overlay.keys, remoteInitiationKeys);

	try {
		await ratchetState.put(overlay);
	} catch (error) {
		throw new DicesOverlayError("Failed to save ratchet state", { cause: error });
	}

	return envelope.buffer;
};
