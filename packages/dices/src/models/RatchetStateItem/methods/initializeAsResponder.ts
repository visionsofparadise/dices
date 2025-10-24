import { x25519 } from "@noble/curves/ed25519";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { RatchetStateItem } from "..";
import { computeRatchetId } from "../../../utilities/computeRatchetId";
import type { Envelope } from "../../Envelope";
import { DicesOverlayError } from "../../Error";
import { KeyChain } from "../../KeyChain";
import type { RatchetKeysItem } from "../../RatchetKeysItem";
import { RootChain } from "../../RootChain";

export const initializeRatchetStateAsResponder = (envelope: Envelope, localNodeId: Uint8Array, localRatchetKeysItem: RatchetKeysItem, remoteNodeId: Uint8Array): RatchetStateItem => {
	if (!envelope.kemCiphertext) {
		throw new DicesOverlayError("kemCiphertext required for ratchet initialization");
	}

	const mlKemSharedSecret = ml_kem1024.decapsulate(envelope.kemCiphertext, localRatchetKeysItem.decryptionKey);

	const ratchetId = computeRatchetId(localNodeId, remoteNodeId);

	const initialRootKey = new Uint8Array(32);

	const dhSharedSecret = x25519.getSharedSecret(localRatchetKeysItem.dhSecretKey, envelope.dhPublicKey);
	const { newRootKey, newChainKey: receivingChainKey } = RootChain.deriveRootKey(initialRootKey, dhSharedSecret, mlKemSharedSecret);

	const dhSecretKey = x25519.utils.randomSecretKey();
	const sendingDhSharedSecret = x25519.getSharedSecret(dhSecretKey, envelope.dhPublicKey);
	const { newRootKey: finalRootKey, newChainKey: sendingChainKey } = RootChain.deriveRootKey(newRootKey, sendingDhSharedSecret);

	const rootChain = new RootChain({
		rootKey: finalRootKey,
		dhSecretKey,
		remoteDhPublicKey: envelope.dhPublicKey,
		sendingChain: new KeyChain({ chainKey: sendingChainKey }),
		receivingChain: new KeyChain({ chainKey: receivingChainKey }),
	});

	const ratchetState = new RatchetStateItem({
		indexKey: RatchetStateItem.INDEX_KEY,
		ratchetId,
		rootChain,
		previousChainLength: 0,
		skippedKeys: [],
		ratchetAt: Date.now(),
	});

	return ratchetState;
};
