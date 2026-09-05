import type { Overlay } from "..";
import { NodeIdCodec } from "../../Keys/Codec";

export const healthcheckOverlay = async (overlay: Overlay): Promise<void> => {
	try {
		if (overlay.isHealthchecking) return;

		overlay.isHealthchecking = true;
		overlay.logger?.debug("Healthchecking");

		const now = Date.now();
		const promises: Array<Promise<any>> = [];

		for (const node of overlay.nodes.table) {
			const isRecentlyContacted = node.lastContactedAt && now - node.lastContactedAt < overlay.options.healthcheckIntervalMs;

			if (isRecentlyContacted) continue;

			promises.push(overlay.ping(node));
		}

		if (promises.length) await Promise.allSettled(promises);

		const isAllMarkedError = overlay.nodes.table.buckets.every((bucket) => bucket.items.every((item) => item.errorCount > 0));

		if (isAllMarkedError || !overlay.nodes.table.length) {
			await overlay.findNode(overlay.keys.nodeId);
			await overlay.findNode(crypto.getRandomValues(new Uint8Array(NodeIdCodec.byteLength())));
		}
	} catch (error) {
		overlay.events.emit("error", error);
	} finally {
		overlay.logger?.debug("Healthchecking complete");
		overlay.isHealthchecking = false;
	}
};
