import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";

describe("Overlay.wrap/unwrap", () => {
	it(
		"wraps and unwraps messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const message = new TextEncoder().encode("Hello from overlayA!");

				// overlayA wraps a message for overlayB using overlayB's initiation keys
				const envelope = await overlayA.wrap(overlayB.keys.nodeId, overlayB.currentRatchetKeys!.publicKeys, message);

				expect(envelope).toBeDefined();
				expect(envelope.magicBytes).toEqual(new TextEncoder().encode("DICES"));

				// overlayB unwraps the message
				const data = await overlayB.unwrap(envelope);

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
						// For first message, provide initiation keys; for subsequent messages, pass undefined
						const initiationKeys = msg.text.includes("First") ? overlayB.currentRatchetKeys!.publicKeys : undefined;
						const envelope = await overlayA.wrap(overlayB.keys.nodeId, initiationKeys, new TextEncoder().encode(msg.text));
						const data = await overlayB.unwrap(envelope);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					} else {
						// For first message, provide initiation keys; for subsequent messages, pass undefined
						const initiationKeys = msg.text.includes("First") ? overlayA.currentRatchetKeys!.publicKeys : undefined;
						const envelope = await overlayB.wrap(overlayA.keys.nodeId, initiationKeys, new TextEncoder().encode(msg.text));
						const data = await overlayA.unwrap(envelope);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					}
				}
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
