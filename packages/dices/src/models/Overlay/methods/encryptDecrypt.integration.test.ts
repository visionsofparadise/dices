import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";
import { encrypt } from "../../../encrypt.js";
import { decrypt } from "../../../decrypt.js";

describe("encrypt/decrypt", () => {
	it(
		"encrypts and decrypts messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const message = new TextEncoder().encode("Hello from overlayA!");

				// encrypt auto-fetches initiation keys from DHT
				const encrypted = await encrypt(overlayB.keys.nodeId, message, overlayA);

				expect(encrypted).toBeDefined();
				expect(encrypted).toBeInstanceOf(Uint8Array);

				// overlayB decrypts the message
				const data = await decrypt(encrypted, overlayB);

				expect(new TextDecoder().decode(data)).toBe("Hello from overlayA!");
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);

	it(
		"maintains session across multiple messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				// Send multiple messages in both directions
				const messages = [
					{ from: "A", text: "First message from A" },
					{ from: "B", text: "First message from B" },
					{ from: "A", text: "Second message from A" },
					{ from: "B", text: "Second message from B" },
				];

				for (const msg of messages) {
					if (msg.from === "A") {
						// encrypt auto-handles initiation keys for both first and subsequent messages
						const encrypted = await encrypt(overlayB.keys.nodeId, new TextEncoder().encode(msg.text), overlayA);
						const data = await decrypt(encrypted, overlayB);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					} else {
						// encrypt auto-handles initiation keys for both first and subsequent messages
						const encrypted = await encrypt(overlayA.keys.nodeId, new TextEncoder().encode(msg.text), overlayB);
						const data = await decrypt(encrypted, overlayA);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					}
				}
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
