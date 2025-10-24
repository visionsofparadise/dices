import { hex } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { getBitwiseDistance } from "kademlia-table";
import { defaults, sampleSize, uniqBy } from "lodash-es";
import { compare } from "uint8array-tools";
import type { Overlay } from "..";
import { Timeout } from "../../../utilities/Timeout";
import { DicesOverlayError } from "../../Error";
import { Keys } from "../../Keys";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";
import type { Node } from "../../Node";
import type { Target } from "../../Target/Codec";
import { createTransactionId } from "../../TransactionId/Codec";
import type { AwaitOverlayResponseOptions } from "./awaitResponse";

export const sendOverlayFindNode = async (overlay: Overlay, nodeId: Uint8Array, options?: AwaitOverlayResponseOptions & SendClientAddressOptions): Promise<Array<Node>> => {
	overlay.logger?.info(`Finding node at ${hex.encode(nodeId)}`);

	const initialNodes = overlay.nodes.table.listClosestToId(nodeId);

	if (initialNodes.some((node) => compare(node.nodeId, nodeId) === 0)) return initialNodes;

	let initialTargets: Array<Target> = initialNodes;

	if (initialNodes.length < overlay.options.concurrency) {
		initialTargets = initialTargets.concat(sampleSize(overlay.options.bootstrapTargets, overlay.options.concurrency - initialNodes.length));
	}

	overlay.logger?.info(`Finding with ${initialTargets.length} initial targets`);

	const history = new Set<string>();
	const timeout = new Timeout(options?.timeoutMs || overlay.options.timeoutMs);

	let results: Array<Array<Node>> = [];

	const promises = initialTargets.map(async (initialTarget) => {
		let distance = getBitwiseDistance(initialTarget.nodeId, nodeId);
		let nodes: Array<Node> = [];
		let target: Target | undefined = initialTarget;

		while (target && !timeout.isExpired) {
			try {
				history.add(hex.encode(target.nodeId));

				overlay.logger?.info(`Finding with target ${hex.encode(target.nodeId)}`);

				const request = new Message({
					body: {
						type: MessageBodyType.FIND_NODE,
						transactionId: createTransactionId(),
						nodeId,
						node: overlay.node,
					},
				});

				const abortController = new AbortController();

				const [_, response] = await Promise.all([
					overlay.send(target, request.buffer, { ...options, signal: abortController.signal }),
					overlay.awaitResponse(
						{
							source: {
								nodeId: target.nodeId,
							},
							body: {
								types: [MessageBodyType.NODES_RESPONSE],
								transactionId: request.body.transactionId,
							},
						},
						defaults({ ...options, sendAbortController: abortController }, overlay.options)
					),
				]);

				if (!Keys.isVerified(response.body.signature, response.hash, response.body.node.publicKey)) throw new DicesOverlayError("Unauthorized response");

				overlay.logger?.info(`Got ${response.body.nodes.length} nodes from target ${hex.encode(target.nodeId)}`);

				distance = getBitwiseDistance(target.nodeId, nodeId);

				nodes = uniqBy(nodes.concat(response.body.nodes), (node) => hex.encode(node.nodeId))
					.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, nodeId) - getBitwiseDistance(nodeB.nodeId, nodeId))
					.slice(0, overlay.nodes.table.bucketSize);
			} catch (error) {
				overlay.nodes.table.markError(target.nodeId);
				overlay.events.emit("error", error);
			}

			target = nodes.find((node) => !!node.diceAddress && !history.has(hex.encode(node.nodeId)) && getBitwiseDistance(node.nodeId, nodeId) < distance);
		}

		return nodes;
	});

	if (promises.length) results = await Promise.all(promises);

	return uniqBy(results.flat(), (node) => hex.encode(node.nodeId))
		.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, nodeId) - getBitwiseDistance(nodeB.nodeId, nodeId))
		.slice(0, overlay.nodes.table.bucketSize);
};
