import { computeRatchetId } from "../../utilities/computeRatchetId";
import type { Overlay } from "../Overlay/index";
import { RatchetStateItem } from "../RatchetStateItem/index";
import { cancelSessionBatch } from "./methods/cancelBatch";
import { closeSession } from "./methods/close";
import { decryptSession } from "./methods/decrypt";
import { encryptSession } from "./methods/encrypt";
import { endSessionBatch } from "./methods/endBatch";
import { saveSession } from "./methods/save";
import { startSessionBatch } from "./methods/startBatch";

/**
 * Session manages encrypted communication with a remote peer.
 *
 * Provides high-level encrypt/decrypt operations with automatic persistence.
 * Supports batch mode for grouping operations without disk writes.
 * Wraps RatchetStateItem for orchestration with Overlay and database.
 */
export class Session {
	readonly overlay: Overlay;
	readonly remoteNodeId: Uint8Array;
	readonly ratchetId: Uint8Array;

	ratchetState?: RatchetStateItem;
	batchSnapshot?: Uint8Array;
	isInBatch: boolean;
	isDirty: boolean;

	constructor(overlay: Overlay, remoteNodeId: Uint8Array) {
		this.overlay = overlay;
		this.remoteNodeId = remoteNodeId;
		this.ratchetId = computeRatchetId(overlay.keys.nodeId, remoteNodeId);
		this.isInBatch = false;
		this.isDirty = false;
	}

	/**
	 * Opens or creates a session with a remote peer.
	 *
	 * Loads existing ratchet state from database if available.
	 * Does not initialize a new session until first encrypt/decrypt operation.
	 *
	 * @param overlay - The DICES overlay instance
	 * @param remoteNodeId - The 20-byte nodeId of the remote peer
	 * @returns Promise resolving to the opened Session
	 *
	 * @example
	 * ```typescript
	 * const session = await Session.open(overlay, peerNodeId);
	 * const encrypted = await session.encrypt(data);
	 * await session.close();
	 * ```
	 */
	static open = async (overlay: Overlay, remoteNodeId: Uint8Array): Promise<Session> => {
		const session = new Session(overlay, remoteNodeId);

		// Try to load existing ratchet state
		const existingState = await RatchetStateItem.get(RatchetStateItem.keyOf({ ratchetId: session.ratchetId }), overlay);

		if (existingState) {
			session.ratchetState = existingState;
		}

		return session;
	};

	/**
	 * Encrypts data for the remote peer.
	 *
	 * Initializes session on first call. Handles ML-KEM rotation when bounds reached.
	 * Automatically saves to database unless in batch mode.
	 *
	 * @param data - Plaintext data to encrypt
	 * @returns Promise resolving to encrypted buffer
	 * @throws {DicesOverlayError} If unable to fetch initiation keys or save fails
	 */
	encrypt = encryptSession.bind(this, this);

	/**
	 * Decrypts data from the remote peer.
	 *
	 * Verifies signature, initializes session if first message, handles DH ratchet.
	 * Automatically saves to database unless in batch mode.
	 *
	 * @param buffer - Encrypted buffer to decrypt
	 * @returns Promise resolving to decrypted data
	 * @throws {DicesOverlayError} If signature verification or decryption fails
	 */
	decrypt = decryptSession.bind(this, this);

	/**
	 * Starts batch mode - operations won't save to disk until endBatch().
	 *
	 * Snapshots current ratchet state for rollback via cancelBatch().
	 *
	 * @throws {DicesOverlayError} If already in batch mode
	 */
	startBatch = startSessionBatch.bind(this, this);

	/**
	 * Ends batch mode and saves all changes to disk.
	 *
	 * @throws {DicesOverlayError} If save fails
	 */
	endBatch = endSessionBatch.bind(this, this);

	/**
	 * Cancels batch mode and discards all changes since startBatch().
	 *
	 * Restores ratchet state from snapshot.
	 */
	cancelBatch = cancelSessionBatch.bind(this, this);

	/**
	 * Saves current ratchet state to database.
	 *
	 * Works in both batch and non-batch mode. Does not exit batch mode.
	 *
	 * @throws {DicesOverlayError} If save fails
	 */
	save = saveSession.bind(this, this);

	/**
	 * Closes the session and saves if dirty.
	 *
	 * Flushes any pending changes to disk.
	 */
	close = closeSession.bind(this, this);
}
