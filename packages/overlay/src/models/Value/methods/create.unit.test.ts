import { x25519 } from "@noble/curves/ed25519";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { compare } from "uint8array-tools";
import { describe, expect, it } from "vitest";
import { Keys } from "../../Keys/index";
import { RatchetKeysPublic } from "../../RatchetKeysItem/PublicCodec";
import { createValue } from "./create";

describe("Value.create", () => {
	it("should create a valid Value with signature", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value = createValue({ initiationKeys }, keys);

		expect(value.initiationKeys).toEqual(initiationKeys);
		expect(value.rSignature).toBeDefined();
		expect(value.rSignature.signature.length).toBe(64); // secp256k1 signature
		expect(value.rSignature.recoveryBit).toBeGreaterThanOrEqual(0);
		expect(value.rSignature.recoveryBit).toBeLessThanOrEqual(3);
		expect(value.signedAt).toBeGreaterThan(0);
	});

	it("should use provided signedAt timestamp", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const customTimestamp = 1234567890000;
		const value = createValue({ initiationKeys, signedAt: customTimestamp }, keys);

		expect(value.signedAt).toBe(customTimestamp);
	});

	it("should recover correct public key from signature", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value = createValue({ initiationKeys }, keys);

		// Value should recover the same public key
		expect(compare(value.publicKey, keys.publicKey)).toBe(0);
	});

	it("should compute correct nodeId from public key", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value = createValue({ initiationKeys }, keys);

		// nodeId should match the keys' nodeId
		expect(compare(value.nodeId, keys.nodeId)).toBe(0);
	});

	it("should fail verification with tampered data", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value = createValue({ initiationKeys }, keys);
		const originalPublicKey = value.publicKey;

		// Tamper with the initiationKeys
		value.initiationKeys.dhPublicKey[0]! ^= 0xff;

		// Clear cache to force recalculation
		value.cache.hash = undefined;
		value.cache.publicKey = undefined;

		// Recovered public key should NOT match original after tampering
		expect(compare(value.publicKey, originalPublicKey)).not.toBe(0);
	});

	it("should create different signatures for different keys", () => {
		const keys1 = new Keys();
		const keys2 = new Keys();

		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value1 = createValue({ initiationKeys }, keys1);
		const value2 = createValue({ initiationKeys }, keys2);

		// Different keys should produce different signatures
		expect(compare(value1.rSignature.signature, value2.rSignature.signature)).not.toBe(0);
	});

	it("should cache hash and publicKey", () => {
		const keys = new Keys();
		const { publicKey: encryptionKey } = ml_kem1024.keygen();
		const dhPublicKey = x25519.getPublicKey(x25519.utils.randomPrivateKey());

		const initiationKeys: RatchetKeysPublic = {
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			encryptionKey,
			dhPublicKey,
		};

		const value = createValue({ initiationKeys }, keys);

		// First access
		const hash1 = value.hash;
		const publicKey1 = value.publicKey;

		// Second access (should be cached)
		const hash2 = value.hash;
		const publicKey2 = value.publicKey;

		expect(hash1).toBe(hash2); // Same instance (cached)
		expect(publicKey1).toBe(publicKey2); // Same instance (cached)
	});
});
