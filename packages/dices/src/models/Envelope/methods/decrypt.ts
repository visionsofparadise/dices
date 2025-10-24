import { compare } from "uint8array-tools";
import type { Envelope } from "..";
import { DicesOverlayError } from "../../Error";
import { RatchetStateItem } from "../../RatchetStateItem";

export const decryptEnvelope = (envelope: Envelope, remoteNodeId: Uint8Array, ratchetState: RatchetStateItem): Uint8Array => {
	// Validate protocol version
	if (envelope.version !== 0x01) {
		throw new DicesOverlayError(`Unsupported protocol version: ${envelope.version}`);
	}

	// Verify signature before decryption - ensure sender is who they claim to be
	if (compare(envelope.nodeId, remoteNodeId) !== 0) {
		throw new DicesOverlayError("Signature verification failed: recovered nodeId does not match expected remoteNodeId");
	}

	// Perform DH ratchet if remote DH key changed
	if (compare(envelope.dhPublicKey, ratchetState.rootChain.remoteDhPublicKey) !== 0) {
		ratchetState.performDhRatchet(envelope.dhPublicKey);
	}

	// Decrypt message
	return ratchetState.decryptMessage(envelope);
};
