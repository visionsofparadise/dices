import { compare } from "uint8array-tools";
import { describe, it, expect } from "vitest";
import { spawnIntegrationBootstrapOverlays } from "./spawnIntegrationBootstrapOverlays.js";
import { INTEGRATION_TEST_TIMEOUT_MS } from "./spawnIntegrationOverlays.js";

describe("spawnIntegrationBootstrapOverlays", () => {
	it(
		"spawns integration bootstrap overlays",
		async () => {
			try {
				await spawnIntegrationBootstrapOverlays(undefined, async (bootstrapOverlays) => {
					for (const overlayA of bootstrapOverlays) {
						for (const overlayB of bootstrapOverlays) {
							if (compare(overlayA.node.nodeId, overlayB.node.nodeId) === 0) continue;

							expect(overlayA.nodes.table.has(overlayA.nodes.table.getId(overlayB.node))).toBe(true);
						}
					}
				});
			} catch (error) {}
		},
		INTEGRATION_TEST_TIMEOUT_MS
	);
});
