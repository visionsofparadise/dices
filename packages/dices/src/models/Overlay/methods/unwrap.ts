import type { Overlay } from "..";
import { computeRatchetId } from "../../../utilities/computeRatchetId";
import { Envelope } from "../../Envelope";
import { DicesOverlayError } from "../../Error";
import { RatchetKeysItem } from "../../RatchetKeysItem";
import { RatchetStateItem } from "../../RatchetStateItem";

export const unwrapOverlayEnvelope = async (overlay: Overlay, envelope: Envelope): Promise<Uint8Array> => {
	const localRatchetKeysItem = await RatchetKeysItem.get(RatchetKeysItem.keyOf({ keyId: envelope.keyId }), overlay);

	if (!localRatchetKeysItem) {
		throw new DicesOverlayError("No local ratchet keys found for keyId");
	}

	const ratchetId = computeRatchetId(overlay.keys.nodeId, envelope.nodeId);

	let ratchetState = await RatchetStateItem.get(RatchetStateItem.keyOf({ ratchetId }), overlay);

	// Explicit initialization for first message from this peer
	if (!ratchetState) {
		if (!envelope.kemCiphertext) {
			throw new DicesOverlayError("Cannot initialize ratchet: missing kemCiphertext in first message");
		}

		ratchetState = RatchetStateItem.initializeAsResponder(envelope, overlay.keys.nodeId, localRatchetKeysItem, envelope.nodeId);
	}

	// Decrypt message
	const data = envelope.decrypt(envelope.nodeId, ratchetState);

	await ratchetState.put(overlay);

	return data;
};
