import { describe, it, expect } from "vitest";
import { INTEGRATION_TEST_TIMEOUT_MS, spawnIntegrationOverlays } from "../../../utilities/spawnIntegrationOverlays.js";

describe("Overlay.findNode", () => {
	it(
		"sends find node",
		async () => {
			await spawnIntegrationOverlays(undefined, async (_, [overlayA, overlayB]) => {
				const nodes = await overlayA.findNode(overlayB.keys.nodeId);

				expect(nodes.length).toBeGreaterThan(0);
				expect(nodes.some((node) => node.nodeId.every((byte, i) => byte === overlayB.keys.nodeId[i]))).toBe(true);
			});
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
