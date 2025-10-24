import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { compare, concat } from "uint8array-tools";
import { DicesOverlayError } from "../Error";
import { KeyChain } from "../KeyChain";
import { RatchetKeysPublic } from "../RatchetKeysItem/PublicCodec";
import { RootChainCodec, RootChainProperties } from "./Codec";

export namespace RootChain {
	export interface Properties extends RootChainProperties {}
}

export class RootChain implements RootChain.Properties {
	private static readonly ROOT_KEY_INFO = new TextEncoder().encode("DICES-v1-root");
	private static readonly ROOT_KEY_SIZE = 32;
	private static readonly CHAIN_KEY_SIZE = 32;
	private static readonly HKDF_OUTPUT_SIZE = RootChain.ROOT_KEY_SIZE + RootChain.CHAIN_KEY_SIZE;

	static deriveRootKey(rootKey: Uint8Array, dhSharedSecret: Uint8Array, mlKemSharedSecret?: Uint8Array): { newRootKey: Uint8Array; newChainKey: Uint8Array } {
		const sharedSecret = mlKemSharedSecret ? concat([dhSharedSecret, mlKemSharedSecret]) : dhSharedSecret;
		const derived = hkdf(sha256, sharedSecret, rootKey, RootChain.ROOT_KEY_INFO, RootChain.HKDF_OUTPUT_SIZE);

		const newRootKey = derived.subarray(0, RootChain.ROOT_KEY_SIZE);
		const newChainKey = derived.subarray(RootChain.ROOT_KEY_SIZE, RootChain.HKDF_OUTPUT_SIZE);

		return { newRootKey, newChainKey };
	}

	rootKey: Uint8Array;
	dhSecretKey: Uint8Array;
	remoteDhPublicKey: Uint8Array;
	sendingChain: KeyChain;
	receivingChain: KeyChain;

	constructor(properties: RootChain.Properties) {
		this.rootKey = properties.rootKey;
		this.dhSecretKey = properties.dhSecretKey;
		this.remoteDhPublicKey = properties.remoteDhPublicKey;
		this.sendingChain = properties.sendingChain;
		this.receivingChain = properties.receivingChain;
	}

	get buffer(): Uint8Array {
		return RootChainCodec.encode(this);
	}

	get byteLength(): number {
		return RootChainCodec.byteLength(this);
	}

	get dhPublicKey(): Uint8Array {
		return x25519.getPublicKey(this.dhSecretKey);
	}

	performDhRatchet(remoteDhPublicKey: Uint8Array): void {
		// Guard: remote DH key must be different from current (otherwise no-op)
		if (compare(remoteDhPublicKey, this.remoteDhPublicKey) === 0) {
			throw new DicesOverlayError("DH ratchet called with same remote public key");
		}

		// Symmetric double ratchet: derive receiving chain, then sending chain
		const dhSharedSecret = x25519.getSharedSecret(this.dhSecretKey, remoteDhPublicKey);
		const { newRootKey, newChainKey: receivingChainKey } = RootChain.deriveRootKey(this.rootKey, dhSharedSecret);

		const newDhSecretKey = x25519.utils.randomSecretKey();
		const sendingDhSharedSecret = x25519.getSharedSecret(newDhSecretKey, remoteDhPublicKey);
		const { newRootKey: finalRootKey, newChainKey: sendingChainKey } = RootChain.deriveRootKey(newRootKey, sendingDhSharedSecret);

		this.rootKey = finalRootKey;
		this.dhSecretKey = newDhSecretKey;
		this.remoteDhPublicKey = remoteDhPublicKey;
		this.sendingChain = new KeyChain({ chainKey: sendingChainKey });
		this.receivingChain = new KeyChain({ chainKey: receivingChainKey });
	}

	performMlKemRatchet(initiationKeys: RatchetKeysPublic): Uint8Array {
		// Guard: validate ML-KEM public key length
		if (initiationKeys.encryptionKey.byteLength !== 1568) {
			throw new DicesOverlayError(`Invalid ML-KEM public key length: ${initiationKeys.encryptionKey.byteLength}, expected 1568`);
		}

		// Guard: validate DH public key length
		if (initiationKeys.dhPublicKey.byteLength !== 32) {
			throw new DicesOverlayError(`Invalid DH public key length: ${initiationKeys.dhPublicKey.byteLength}, expected 32`);
		}

		const { cipherText, sharedSecret: mlKemSharedSecret } = ml_kem1024.encapsulate(initiationKeys.encryptionKey);
		const newDhSecretKey = x25519.utils.randomSecretKey();
		const dhSharedSecret = x25519.getSharedSecret(newDhSecretKey, initiationKeys.dhPublicKey);

		const { newRootKey, newChainKey: sendingChainKey } = RootChain.deriveRootKey(this.rootKey, dhSharedSecret, mlKemSharedSecret);

		this.rootKey = newRootKey;
		this.dhSecretKey = newDhSecretKey;
		this.remoteDhPublicKey = initiationKeys.dhPublicKey;
		this.sendingChain = new KeyChain({ chainKey: sendingChainKey });
		this.receivingChain = new KeyChain();

		return cipherText;
	}
}
