import { compare } from "uint8array-tools";
import { describe, expect, it } from "vitest";
import { Envelope } from "../models/Envelope/index.js";
import { Keys } from "../models/Keys/index.js";
import { RatchetKeysItem } from "../models/RatchetKeysItem/index.js";
import { RatchetStateItem } from "../models/RatchetStateItem/index.js";

describe("DICES Crypto System Integration", () => {
	it("should encrypt and decrypt messages through full ratchet", () => {
		// Alice and Bob's identities
		const aliceKeys = new Keys();
		const bobKeys = new Keys();

		// Bob creates initiation keys (ML-KEM + X25519)
		const bobRatchetKeys = new RatchetKeysItem();

		// Alice initiates session with Bob's initiation keys (sends first message)
		const message1 = new TextEncoder().encode("Hello Bob!");
		const { ratchetState: aliceState, envelope: envelope1 } = RatchetStateItem.initializeAsInitiator(aliceKeys.nodeId, bobKeys.nodeId, bobRatchetKeys.publicKeys, message1, aliceKeys);

		// Verify envelope structure
		expect(envelope1.version).toBe(0x01);
		expect(envelope1.messageNumber).toBe(0);
		expect(envelope1.kemCiphertext).toBeDefined(); // First message includes ML-KEM ciphertext

		// Bob receives and decrypts (initializes responder state)
		const bobState = RatchetStateItem.initializeAsResponder(envelope1, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		const decrypted1 = bobState.decryptMessage(envelope1);

		expect(new TextDecoder().decode(decrypted1)).toBe("Hello Bob!");

		// Bob needs Alice's ratchet keys to reply (in production this would be fetched from DHT)
		const aliceRatchetKeys = new RatchetKeysItem();
		bobState.remoteKeyId = aliceRatchetKeys.keyId;

		// Bob replies
		const message2 = new TextEncoder().encode("Hi Alice!");
		const envelope2 = bobState.encryptMessage(message2, bobKeys);

		// Alice decrypts Bob's reply
		const decrypted2 = aliceState.decryptMessage(envelope2);
		expect(new TextDecoder().decode(decrypted2)).toBe("Hi Alice!");

		// Continue conversation
		const message3 = new TextEncoder().encode("How are you?");
		const envelope3 = aliceState.encryptMessage(message3, aliceKeys);
		const decrypted3 = bobState.decryptMessage(envelope3);
		expect(new TextDecoder().decode(decrypted3)).toBe("How are you?");
	});

	it("should handle out-of-order messages with skipped keys", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		// Alice initiates
		const { ratchetState: aliceState, envelope: envelope0 } = RatchetStateItem.initializeAsInitiator(
			aliceKeys.nodeId,
			bobKeys.nodeId,
			bobRatchetKeys.publicKeys,
			new TextEncoder().encode("msg0"),
			aliceKeys
		);

		// Alice sends messages 1, 2
		const envelope1 = aliceState.encryptMessage(new TextEncoder().encode("msg1"), aliceKeys);
		const envelope2 = aliceState.encryptMessage(new TextEncoder().encode("msg2"), aliceKeys);

		// Bob receives message 0 first
		const bobState = RatchetStateItem.initializeAsResponder(envelope0, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		const decrypted0 = bobState.decryptMessage(envelope0);
		expect(new TextDecoder().decode(decrypted0)).toBe("msg0");

		// Bob receives message 2 (skipping message 1)
		const decrypted2 = bobState.decryptMessage(envelope2);
		expect(new TextDecoder().decode(decrypted2)).toBe("msg2");

		// Verify skipped keys were stored
		expect(bobState.skippedKeys.length).toBeGreaterThan(0);

		// Bob finally receives message 1 (should use skipped key)
		const decrypted1 = bobState.decryptMessage(envelope1);
		expect(new TextDecoder().decode(decrypted1)).toBe("msg1");
	});

	it("should enforce DoS protection on message skip limit", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		// Alice initiates
		const { ratchetState: aliceState, envelope: envelope0 } = RatchetStateItem.initializeAsInitiator(
			aliceKeys.nodeId,
			bobKeys.nodeId,
			bobRatchetKeys.publicKeys,
			new TextEncoder().encode("msg0"),
			aliceKeys
		);

		const bobState = RatchetStateItem.initializeAsResponder(envelope0, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		bobState.decryptMessage(envelope0);

		// Manually advance Alice's sending chain by a huge amount (> 1000)
		for (let i = 0; i < 1500; i++) {
			aliceState.rootChain.sendingChain.next();
		}

		// Alice sends message 1500
		const envelope1500 = aliceState.encryptMessage(new TextEncoder().encode("msg1500"), aliceKeys);

		// Bob should reject this (message skip > 1000)
		expect(() => bobState.decryptMessage(envelope1500)).toThrow("Message skip too large");
	});

	it("should perform DH ratchet when remote DH key changes", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		// Initial exchange
		const { ratchetState: aliceState, envelope: envelope0 } = RatchetStateItem.initializeAsInitiator(
			aliceKeys.nodeId,
			bobKeys.nodeId,
			bobRatchetKeys.publicKeys,
			new TextEncoder().encode("msg0"),
			aliceKeys
		);

		const bobState = RatchetStateItem.initializeAsResponder(envelope0, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		bobState.decryptMessage(envelope0);

		// Bob needs Alice's ratchet keys to reply
		const aliceRatchetKeys = new RatchetKeysItem();
		bobState.remoteKeyId = aliceRatchetKeys.keyId;

		// Bob's initial DH public key
		const bobInitialDhPublicKey = bobState.rootChain.dhPublicKey;

		// Bob sends a message (DH key stays stable - no remote DH change yet)
		const envelope1 = bobState.encryptMessage(new TextEncoder().encode("msg1"), bobKeys);

		// Bob's DH public key should NOT have changed (no DH ratchet yet)
		const bobDhPublicKeyAfterSend = bobState.rootChain.dhPublicKey;
		expect(compare(bobInitialDhPublicKey, bobDhPublicKeyAfterSend)).toBe(0);

		// Alice receives and performs DH ratchet
		const aliceInitialDhKey = aliceState.rootChain.remoteDhPublicKey;
		aliceState.decryptMessage(envelope1);

		// Alice should have updated her remote DH key to Bob's current key
		expect(compare(aliceState.rootChain.remoteDhPublicKey, bobDhPublicKeyAfterSend)).toBe(0);
		expect(compare(aliceState.rootChain.remoteDhPublicKey, aliceInitialDhKey)).not.toBe(0);
	});

	it("should perform ML-KEM ratchet when bounds are reached", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		// Initial exchange
		const { ratchetState: aliceState, envelope: envelope0 } = RatchetStateItem.initializeAsInitiator(
			aliceKeys.nodeId,
			bobKeys.nodeId,
			bobRatchetKeys.publicKeys,
			new TextEncoder().encode("msg0"),
			aliceKeys
		);

		const bobState = RatchetStateItem.initializeAsResponder(envelope0, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		bobState.decryptMessage(envelope0);

		// Bob creates new initiation keys for rotation
		const bobNewRatchetKeys = new RatchetKeysItem();

		// Alice sends many messages to reach the bound (already sent 1, need 99 more)
		for (let i = 1; i < 100; i++) {
			aliceState.encryptMessage(new TextEncoder().encode(`msg${i}`), aliceKeys);
		}

		// Next message should trigger ML-KEM rotation (message 100)
		const envelope100 = Envelope.encrypt(new TextEncoder().encode("msg100"), aliceState, aliceKeys, bobNewRatchetKeys.publicKeys);

		// Envelope should contain KEM ciphertext
		expect(envelope100.kemCiphertext).toBeDefined();
		expect(envelope100.kemCiphertext!.length).toBe(1568); // ML-KEM-1024 ciphertext size
	});

	it("should verify signature recovery works correctly", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		const { envelope } = RatchetStateItem.initializeAsInitiator(aliceKeys.nodeId, bobKeys.nodeId, bobRatchetKeys.publicKeys, new TextEncoder().encode("test"), aliceKeys);

		// Envelope should recover Alice's public key from signature
		expect(compare(envelope.publicKey, aliceKeys.publicKey)).toBe(0);
		expect(compare(envelope.nodeId, aliceKeys.nodeId)).toBe(0);

		// Tampered envelope should recover wrong public key
		envelope.cipherData.data[0]! ^= 0xff;
		envelope.cache.hash = undefined;
		envelope.cache.publicKey = undefined;

		expect(compare(envelope.publicKey, aliceKeys.publicKey)).not.toBe(0);
	});

	it("should maintain forward secrecy (old keys cannot decrypt new messages)", () => {
		const aliceKeys = new Keys();
		const bobKeys = new Keys();
		const bobRatchetKeys = new RatchetKeysItem();

		// Initial exchange
		const { ratchetState: aliceState, envelope: envelope0 } = RatchetStateItem.initializeAsInitiator(
			aliceKeys.nodeId,
			bobKeys.nodeId,
			bobRatchetKeys.publicKeys,
			new TextEncoder().encode("msg0"),
			aliceKeys
		);

		// Capture chain key after message 0
		const chainKeyAfterMsg0 = new Uint8Array(aliceState.rootChain.sendingChain.chainKey!);

		// Send message 1
		const envelope1 = aliceState.encryptMessage(new TextEncoder().encode("msg1"), aliceKeys);

		// Chain key should have advanced
		expect(compare(aliceState.rootChain.sendingChain.chainKey!, chainKeyAfterMsg0)).not.toBe(0);

		// Bob should be able to decrypt both messages
		const bobState = RatchetStateItem.initializeAsResponder(envelope0, bobKeys.nodeId, bobRatchetKeys, aliceKeys.nodeId);
		bobState.decryptMessage(envelope0);
		const decrypted = bobState.decryptMessage(envelope1);
		expect(new TextDecoder().decode(decrypted)).toBe("msg1");
	});
});
