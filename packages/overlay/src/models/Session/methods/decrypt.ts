import type { Session } from "../index.js";
import { DicesOverlayError } from "../../Error/index.js";
import { EnvelopeCodec } from "../../Envelope/Codec.js";
import { RatchetKeysItem } from "../../RatchetKeysItem/index.js";
import { RatchetStateItem } from "../../RatchetStateItem/index.js";

export const decryptSession = async (session: Session, buffer: Uint8Array): Promise<Uint8Array> => {
	const envelopeInstance = EnvelopeCodec.decode(buffer);

	// SECURITY: Verify signature BEFORE any database operations to fail fast on invalid envelopes
	const remoteNodeId = envelopeInstance.nodeId;
	envelopeInstance.verify(remoteNodeId);

	// Verify this envelope is from the expected remote peer
	if (Buffer.compare(remoteNodeId, session.remoteNodeId) !== 0) {
		throw new DicesOverlayError("Envelope from unexpected remote peer");
	}

	const localRatchetKeysItem = await RatchetKeysItem.get(
		RatchetKeysItem.keyOf({ keyId: envelopeInstance.keyId }),
		session.overlay
	);

	if (!localRatchetKeysItem) {
		throw new DicesOverlayError("Decryption failed", {
			internalDetails: `No local ratchet keys found for keyId: ${Buffer.from(envelopeInstance.keyId).toString("hex")}`
		});
	}

	// Initialize ratchet state if first message from this peer
	if (!session.ratchetState) {
		if (!envelopeInstance.kemCiphertext) {
			throw new DicesOverlayError("Cannot initialize ratchet: missing kemCiphertext in first message");
		}

		session.ratchetState = RatchetStateItem.initializeAsResponder(
			envelopeInstance,
			session.overlay.keys.nodeId,
			localRatchetKeysItem,
			remoteNodeId
		);

		session.isDirty = true;
	}

	// Decrypt message
	const data = envelopeInstance.decrypt(remoteNodeId, session.ratchetState);

	session.isDirty = true;

	// Save immediately unless in batch mode
	if (!session.isInBatch) {
		await session.save();
	}

	return data;
};
