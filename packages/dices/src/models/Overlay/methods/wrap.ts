import type { Overlay } from "..";
import { computeRatchetId } from "../../../utilities/computeRatchetId";
import { Envelope } from "../../Envelope";
import { DicesOverlayError } from "../../Error";
import { RatchetKeysPublic } from "../../RatchetKeysItem/PublicCodec";
import { RatchetStateItem } from "../../RatchetStateItem";

export const wrapOverlayEnvelope = async (overlay: Overlay, remoteNodeId: Uint8Array, remoteInitiationKeys: RatchetKeysPublic | undefined, data: Uint8Array): Promise<Envelope> => {
	const ratchetId = computeRatchetId(overlay.keys.nodeId, remoteNodeId);

	let ratchetState = await RatchetStateItem.get(RatchetStateItem.keyOf({ ratchetId }), overlay);

	if (!ratchetState) {
		if (!remoteInitiationKeys) {
			throw new DicesOverlayError("Initiation keys required for first message");
		}

		const { envelope, ratchetState } = RatchetStateItem.initializeAsInitiator(overlay.keys.nodeId, remoteNodeId, remoteInitiationKeys, data, overlay.keys);

		try {
			await ratchetState.put(overlay);
		} catch (error) {
			throw new DicesOverlayError("Failed to save ratchet state", { cause: error });
		}

		return envelope;
	}

	// Set remoteKeyId if not already set (responder's first send)
	if (!ratchetState.remoteKeyId && remoteInitiationKeys) {
		ratchetState.remoteKeyId = remoteInitiationKeys.keyId;
	}

	if (!ratchetState.remoteKeyId) {
		throw new DicesOverlayError("Remote keyId not set and no initiation keys provided");
	}

	const envelope = Envelope.encrypt(data, ratchetState, overlay.keys, remoteInitiationKeys);

	try {
		await ratchetState.put(overlay);
	} catch (error) {
		throw new DicesOverlayError("Failed to save ratchet state", { cause: error });
	}

	return envelope;
};
