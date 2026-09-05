import type { Session } from "../index.js";
import { DicesOverlayError } from "../../Error/index.js";
import { RatchetKeysPublic } from "../../RatchetKeysItem/PublicCodec.js";
import { RatchetStateItem } from "../../RatchetStateItem/index.js";
import { Envelope } from "../../Envelope/index.js";

/**
 * Gets or creates a ratchet state for the session.
 *
 * If no state exists, fetches initiation keys from DHT and initializes a new session.
 */
const getOrCreateRatchetState = async (
	session: Session,
	data: Uint8Array
): Promise<{ ratchetState: RatchetStateItem; envelope?: Envelope }> => {
	if (session.ratchetState) {
		return { ratchetState: session.ratchetState };
	}

	// New session - fetch initiation keys and initialize
	let remoteInitiationKeys: RatchetKeysPublic;

	try {
		remoteInitiationKeys = await session.overlay.getInitiationKeys(session.remoteNodeId);
	} catch (error) {
		throw new DicesOverlayError("Failed to fetch initiation keys for first message", { cause: error });
	}

	const { envelope, ratchetState } = RatchetStateItem.initializeAsInitiator(
		session.overlay.keys.nodeId,
		session.remoteNodeId,
		remoteInitiationKeys,
		data,
		session.overlay.keys
	);

	session.ratchetState = ratchetState;
	session.isDirty = true;

	return { ratchetState, envelope };
};

/**
 * Ensures remote keyId is set on ratchet state.
 *
 * For responder's first send, we need to fetch the remote initiation keys.
 */
const ensureRemoteKeyId = async (session: Session): Promise<RatchetKeysPublic | undefined> => {
	if (!session.ratchetState) {
		throw new DicesOverlayError("Ratchet state not initialized");
	}

	if (session.ratchetState.remoteKeyId) {
		return undefined;
	}

	try {
		const remoteInitiationKeys = await session.overlay.getInitiationKeys(session.remoteNodeId);
		session.ratchetState.remoteKeyId = remoteInitiationKeys.keyId;
		session.isDirty = true;
		return remoteInitiationKeys;
	} catch (error) {
		throw new DicesOverlayError("Failed to fetch initiation keys for session", { cause: error });
	}
};

export const encryptSession = async (session: Session, data: Uint8Array): Promise<Uint8Array> => {
	// Get or create ratchet state for this peer
	const { ratchetState, envelope: initialEnvelope } = await getOrCreateRatchetState(session, data);

	// If this was a new session, we already have the envelope
	if (initialEnvelope) {
		// Save immediately unless in batch mode
		if (!session.isInBatch) {
			await session.save();
		}

		return initialEnvelope.buffer;
	}

	// For existing sessions, ensure remote keyId is set (needed for responder's first send)
	const remoteInitiationKeys = await ensureRemoteKeyId(session);

	// Encrypt the message using the ratchet state
	const envelope = Envelope.encrypt(data, ratchetState, session.overlay.keys, remoteInitiationKeys);

	session.isDirty = true;

	// Save immediately unless in batch mode
	if (!session.isInBatch) {
		await session.save();
	}

	return envelope.buffer;
};
