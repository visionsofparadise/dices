import { compare } from "uint8array-tools";
import type { RatchetStateItem } from "..";
import type { Envelope } from "../../Envelope";
import { DicesOverlayError } from "../../Error";

const MAX_MESSAGE_SKIP = 1000; // Configurable limit to prevent DoS

export const decryptRatchetStateMessage = (ratchetState: RatchetStateItem, envelope: Envelope): Uint8Array => {
	const skippedData = ratchetState.trySkippedKey(envelope);

	if (skippedData) return skippedData;

	// Check if DH ratchet is needed (remote DH key changed)
	if (compare(envelope.dhPublicKey, ratchetState.rootChain.remoteDhPublicKey) !== 0) {
		ratchetState.performDhRatchet(envelope.dhPublicKey);
	}

	// Validate receivingChain is initialized
	if (!ratchetState.rootChain.receivingChain.chainKey) {
		throw new DicesOverlayError("Receiving chain not initialized");
	}

	// Check for unbounded loop - prevent DoS attack
	const messageDifference = envelope.messageNumber - ratchetState.rootChain.receivingChain.messageNumber;
	if (messageDifference > MAX_MESSAGE_SKIP) {
		throw new DicesOverlayError(`Message skip too large: ${messageDifference} > ${MAX_MESSAGE_SKIP}`);
	}

	while (ratchetState.rootChain.receivingChain.messageNumber < envelope.messageNumber) {
		ratchetState.storeSkippedKeys(ratchetState.rootChain.receivingChain.messageNumber, ratchetState.rootChain.receivingChain.secret);
		ratchetState.rootChain.receivingChain.next();
	}

	const data = envelope.cipherData.decrypt(ratchetState.rootChain.receivingChain.secret);
	ratchetState.rootChain.receivingChain.next();

	return data;
};
