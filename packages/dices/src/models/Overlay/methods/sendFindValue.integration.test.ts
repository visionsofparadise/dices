import { describe, expect, it } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";

describe("Overlay.findValue", () => {
	it(
		"sends find value",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const foundValue = await overlayA.findValue(overlayB.keys.nodeId);

				expect(foundValue).toBeDefined();
				expect(foundValue!.initiationKeys).toBeDefined();
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
