import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../utilities/spawnIntegrationOverlays.js";
import { Session } from "./index.js";

describe("Session integration", () => {
	it(
		"should open session and encrypt/decrypt messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA = await Session.open(overlayA, overlayB.keys.nodeId);
				const message = new TextEncoder().encode("Hello from session A!");

				// First message - auto-initializes ratchet
				const encrypted = await sessionA.encrypt(message);

				expect(encrypted).toBeDefined();
				expect(encrypted).toBeInstanceOf(Uint8Array);

				const sessionB = await Session.open(overlayB, overlayA.keys.nodeId);
				const decrypted = await sessionB.decrypt(encrypted);

				expect(new TextDecoder().decode(decrypted)).toBe("Hello from session A!");
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"should maintain session across multiple messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA = await Session.open(overlayA, overlayB.keys.nodeId);
				const sessionB = await Session.open(overlayB, overlayA.keys.nodeId);

				// Send multiple messages bidirectionally
				for (let i = 0; i < 5; i++) {
					const msgA = new TextEncoder().encode(`A→B message ${i}`);
					const encryptedA = await sessionA.encrypt(msgA);
					const decryptedA = await sessionB.decrypt(encryptedA);
					expect(new TextDecoder().decode(decryptedA)).toBe(`A→B message ${i}`);

					const msgB = new TextEncoder().encode(`B→A message ${i}`);
					const encryptedB = await sessionB.encrypt(msgB);
					const decryptedB = await sessionA.decrypt(encryptedB);
					expect(new TextDecoder().decode(decryptedB)).toBe(`B→A message ${i}`);
				}

				await sessionA.close();
				await sessionB.close();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"should support batch mode for efficient multi-message operations",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA = await Session.open(overlayA, overlayB.keys.nodeId);
				const sessionB = await Session.open(overlayB, overlayA.keys.nodeId);

				sessionA.startBatch();

				// Encrypt 10 messages without hitting DB
				const encrypted: Uint8Array[] = [];
				for (let i = 0; i < 10; i++) {
					const msg = new TextEncoder().encode(`Batch message ${i}`);
					encrypted.push(await sessionA.encrypt(msg));
					expect(sessionA.isDirty).toBe(true);
				}

				// Commit batch
				await sessionA.endBatch();
				expect(sessionA.isDirty).toBe(false);
				expect(sessionA.isInBatch).toBe(false);

				// Decrypt all messages
				for (let i = 0; i < 10; i++) {
					const decrypted = await sessionB.decrypt(encrypted[i]);
					expect(new TextDecoder().decode(decrypted)).toBe(`Batch message ${i}`);
				}

				await sessionA.close();
				await sessionB.close();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"should rollback batch on cancel",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA = await Session.open(overlayA, overlayB.keys.nodeId);

				// Send one message to initialize state
				const msg1 = new TextEncoder().encode("Initial message");
				await sessionA.encrypt(msg1);

				// Start batch and send messages
				sessionA.startBatch();
				const msg2 = new TextEncoder().encode("Batch message 1");
				const msg3 = new TextEncoder().encode("Batch message 2");

				await sessionA.encrypt(msg2);
				await sessionA.encrypt(msg3);

				expect(sessionA.ratchetState!.rootChain.sendingChain.messageNumber).toBe(3);

				// Cancel batch - should rollback to message 1
				sessionA.cancelBatch();

				expect(sessionA.ratchetState!.rootChain.sendingChain.messageNumber).toBe(1);
				expect(sessionA.isDirty).toBe(false);

				await sessionA.close();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"should reuse existing session on subsequent open",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA1 = await Session.open(overlayA, overlayB.keys.nodeId);

				// Send initial message
				const msg1 = new TextEncoder().encode("First session message");
				await sessionA1.encrypt(msg1);
				await sessionA1.close();

				// Open new session - should load existing state
				const sessionA2 = await Session.open(overlayA, overlayB.keys.nodeId);

				expect(sessionA2.ratchetState).toBeDefined();
				expect(sessionA2.ratchetState!.rootChain.sendingChain.messageNumber).toBe(1);

				// Should be able to continue encrypting
				const msg2 = new TextEncoder().encode("Second session message");
				await sessionA2.encrypt(msg2);

				expect(sessionA2.ratchetState!.rootChain.sendingChain.messageNumber).toBe(2);

				await sessionA2.close();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"should handle explicit save",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const sessionA = await Session.open(overlayA, overlayB.keys.nodeId);

				sessionA.startBatch();

				const msg = new TextEncoder().encode("Message");
				await sessionA.encrypt(msg);

				expect(sessionA.isDirty).toBe(true);

				// Explicit save during batch
				await sessionA.save();

				expect(sessionA.isDirty).toBe(false);
				expect(sessionA.isInBatch).toBe(true); // Still in batch

				await sessionA.endBatch();
				await sessionA.close();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
