import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519";
import { CipherData } from "../CipherData/index.js";
import { Keys } from "../Keys/index.js";
import { Envelope } from "./index.js";
import { EnvelopeCodec } from "./Codec.js";
import { MAGIC_BYTES } from "../../utilities/magicBytes.js";

describe("Envelope serialization", () => {
	it("should serialize and deserialize envelope correctly", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);

		const envelope = new Envelope({
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
			messageNumber: 42,
			previousChainLength: 10,
			cipherData,
			rSignature: keys.rSign(crypto.getRandomValues(new Uint8Array(32))),
		});

		const buffer = EnvelopeCodec.encode(envelope);
		const decoded = EnvelopeCodec.decode(buffer);

		expect(decoded.magicBytes).toEqual(MAGIC_BYTES);
		expect(decoded.version).toBe(0x01);
		expect(decoded.keyId).toEqual(envelope.keyId);
		expect(decoded.dhPublicKey).toEqual(envelope.dhPublicKey);
		expect(decoded.messageNumber).toBe(42);
		expect(decoded.previousChainLength).toBe(10);
		expect(decoded.cipherData.nonce).toEqual(cipherData.nonce);
		expect(decoded.cipherData.data).toEqual(cipherData.data);
		expect(decoded.rSignature).toEqual(envelope.rSignature);
	});

	it("should include magic bytes in serialized format", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);

		const envelope = new Envelope({
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
			messageNumber: 0,
			previousChainLength: 0,
			cipherData,
			rSignature: keys.rSign(crypto.getRandomValues(new Uint8Array(32))),
		});

		const buffer = envelope.buffer;

		// Check magic bytes at start
		expect(buffer.slice(0, MAGIC_BYTES.length)).toEqual(MAGIC_BYTES);
	});

	it("should handle envelope with kemCiphertext", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);
		const kemCiphertext = crypto.getRandomValues(new Uint8Array(1568)); // ML-KEM-1024 ciphertext size

		const envelope = new Envelope({
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
			messageNumber: 0,
			previousChainLength: 0,
			kemCiphertext,
			cipherData,
			rSignature: keys.rSign(crypto.getRandomValues(new Uint8Array(32))),
		});

		const buffer = EnvelopeCodec.encode(envelope);
		const decoded = EnvelopeCodec.decode(buffer);

		expect(decoded.kemCiphertext).toEqual(kemCiphertext);
	});

	it("should handle envelope without kemCiphertext", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);

		const envelope = new Envelope({
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
			messageNumber: 0,
			previousChainLength: 0,
			cipherData,
			rSignature: keys.rSign(crypto.getRandomValues(new Uint8Array(32))),
		});

		const buffer = EnvelopeCodec.encode(envelope);
		const decoded = EnvelopeCodec.decode(buffer);

		expect(decoded.kemCiphertext).toBeUndefined();
	});

	it("should recover correct public key from signature", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);

		const envelope = Envelope.create(
			{
				keyId: crypto.getRandomValues(new Uint8Array(8)),
				dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
				messageNumber: 0,
				previousChainLength: 0,
				cipherData,
			},
			keys
		);

		// Should recover same public key
		expect(envelope.publicKey).toEqual(keys.publicKey);
	});

	it("should cache buffer and byteLength", () => {
		const keys = new Keys();
		const data = new TextEncoder().encode("test");
		const cipherData = CipherData.encrypt(crypto.getRandomValues(new Uint8Array(32)), data);

		const envelope = new Envelope({
			keyId: crypto.getRandomValues(new Uint8Array(8)),
			dhPublicKey: x25519.getPublicKey(x25519.utils.randomPrivateKey()),
			messageNumber: 0,
			previousChainLength: 0,
			cipherData,
			rSignature: keys.rSign(crypto.getRandomValues(new Uint8Array(32))),
		});

		const buffer1 = envelope.buffer;
		const buffer2 = envelope.buffer;

		// Should return same cached instance
		expect(buffer1).toBe(buffer2);

		const byteLength1 = envelope.byteLength;
		const byteLength2 = envelope.byteLength;

		expect(byteLength1).toBe(byteLength2);
	});
});
