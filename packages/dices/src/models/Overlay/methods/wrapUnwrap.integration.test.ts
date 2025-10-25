import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";
import { wrap } from "../../../wrap.js";
import { unwrap } from "../../../unwrap.js";

describe("wrap/unwrap", () => {
	it(
		"wraps and unwraps messages",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const message = new TextEncoder().encode("Hello from overlayA!");

				// wrap auto-fetches initiation keys from DHT
				const envelope = await wrap(overlayB.keys.nodeId, message, overlayA);

				expect(envelope).toBeDefined();
				expect(envelope.magicBytes).toEqual(new TextEncoder().encode("DICES"));

				// overlayB unwraps the message
				const data = await unwrap(envelope, overlayB);

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
						// wrap auto-handles initiation keys for both first and subsequent messages
						const envelope = await wrap(overlayB.keys.nodeId, new TextEncoder().encode(msg.text), overlayA);
						const data = await unwrap(envelope, overlayB);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					} else {
						// wrap auto-handles initiation keys for both first and subsequent messages
						const envelope = await wrap(overlayA.keys.nodeId, new TextEncoder().encode(msg.text), overlayB);
						const data = await unwrap(envelope, overlayA);
						expect(new TextDecoder().decode(data)).toBe(msg.text);
					}
				}
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
