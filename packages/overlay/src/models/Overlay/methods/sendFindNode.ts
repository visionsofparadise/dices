import { hex } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { getBitwiseDistance } from "kademlia-table";
import { defaults, sampleSize, uniqBy } from "lodash-es";
import { compare } from "uint8array-tools";
import type { Overlay } from "..";
import { traverseNodes } from "../../../utilities/traverseNodes.js";
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

	const results: Array<Array<Node>> = [];

	await traverseNodes(overlay, nodeId, initialTargets, options, async (target) => {
		const request = new Message({
			body: {
				type: MessageBodyType.FIND_NODE,
				transactionId: createTransactionId(),
				nodeId,
				node: overlay.node,
			},
		});

		const abortController = new AbortController();

		let response: Message<MessageBodyType.NODES_RESPONSE>;

		try {
			const [, resp] = await Promise.all([
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

			response = resp;
		} catch (error) {
			// Abort awaiting response if send failed
			abortController.abort();
			throw error;
		}

		if (!Keys.isVerified(response.body.signature, response.hash, response.body.node.publicKey)) throw new DicesOverlayError("Unauthorized response");

		overlay.logger?.info(`Got ${response.body.nodes.length} nodes from target ${hex.encode(target.nodeId)}`);

		const nodes = uniqBy(response.body.nodes, (node) => hex.encode(node.nodeId))
			.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, nodeId) - getBitwiseDistance(nodeB.nodeId, nodeId))
			.slice(0, overlay.nodes.table.bucketSize);

		results.push(nodes);

		return nodes;
	});

	return uniqBy(results.flat(), (node) => hex.encode(node.nodeId))
		.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, nodeId) - getBitwiseDistance(nodeB.nodeId, nodeId))
		.slice(0, overlay.nodes.table.bucketSize);
};
