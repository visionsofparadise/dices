import { hex } from "@scure/base";
import type { SendClientAddressOptions } from "@xkore/dice";
import { getBitwiseDistance } from "kademlia-table";
import type { AwaitOverlayResponseOptions } from "../models/Overlay/methods/awaitResponse.js";
import type { Overlay } from "../models/Overlay/index.js";
import type { Node } from "../models/Node/index.js";
import type { Target } from "../models/Target/Codec.js";
import { Timeout } from "./Timeout.js";

export const traverseNodes = async (
	overlay: Overlay,
	targetId: Uint8Array,
	initialTargets: Array<Target>,
	options: (AwaitOverlayResponseOptions & SendClientAddressOptions) | undefined,
	processTarget: (target: Target) => Promise<Array<Node> | undefined>
): Promise<void> => {
	const history = new Set<string>();
	const timeout = new Timeout(options?.timeoutMs || overlay.options.timeoutMs);

	const promises = initialTargets.map(async (initialTarget): Promise<void> => {
		let distance = getBitwiseDistance(initialTarget.nodeId, targetId);
		let nodes: Array<Node> = [];
		let target: Target | undefined = initialTarget;

		while (target && !timeout.isExpired) {
			try {
				history.add(hex.encode(target.nodeId));

				overlay.logger?.info(`Finding with target ${hex.encode(target.nodeId)}`);

				const result = await processTarget(target);

				// If undefined, stop this traversal branch
				if (!result) {
					return;
				}

				// Otherwise continue iterating with the returned nodes
				nodes = result;
				distance = getBitwiseDistance(target.nodeId, targetId);
			} catch (error) {
				overlay.nodes.table.markError(target.nodeId);
				overlay.events.emit("error", error);
			}

			target = nodes.find(
				(node) =>
					!!node.diceAddress &&
					!history.has(hex.encode(node.nodeId)) &&
					getBitwiseDistance(node.nodeId, targetId) < distance
			);
		}
	});

	await Promise.all(promises);
};
