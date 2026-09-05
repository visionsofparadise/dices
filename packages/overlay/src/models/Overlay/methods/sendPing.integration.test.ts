import { compare } from "uint8array-tools";
import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";

describe("Overlay.ping", () => {
	it(
		"sends ping",
		async () => {
			expect.assertions(1);

			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				try {
					overlayA.diceClient.events.on("error", (error) => {
						console.log({ error });
					});

					overlayA.events.on("error", (error) => {
						console.log({ error });
					});

					const node = await overlayA.ping(overlayB.node);

					expect(compare(node.nodeId, overlayB.keys.nodeId) === 0).toBe(true);
				} catch (error) {}
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
