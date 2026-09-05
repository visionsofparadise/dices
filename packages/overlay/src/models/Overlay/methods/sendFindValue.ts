import { hex } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { getBitwiseDistance } from "kademlia-table";
import { defaults, sampleSize, uniqBy } from "lodash-es";
import type { Overlay } from "..";
import { traverseNodes } from "../../../utilities/traverseNodes.js";
import { DicesOverlayError } from "../../Error";
import { Keys } from "../../Keys";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";
import type { Target } from "../../Target/Codec";
import { createTransactionId } from "../../TransactionId/Codec";
import type { Value } from "../../Value";
import type { AwaitOverlayResponseOptions } from "./awaitResponse";

export const sendOverlayFindValue = async (overlay: Overlay, key: Uint8Array, options?: AwaitOverlayResponseOptions & SendClientAddressOptions): Promise<Value | undefined> => {
	overlay.logger?.info(`Finding value at ${hex.encode(key)}`);

	let initialTargets: Array<Target> = overlay.nodes.table.listClosestToId(key);

	if (initialTargets.length < overlay.options.concurrency) {
		initialTargets = initialTargets.concat(sampleSize(overlay.options.bootstrapTargets, overlay.options.concurrency - initialTargets.length));
	}

	overlay.logger?.info(`Finding with ${initialTargets.length} initial targets`);

	const values: Array<Value> = [];

	await traverseNodes(overlay, key, initialTargets, options, async (target) => {
		const request = new Message({
			body: {
				type: MessageBodyType.FIND_VALUE,
				transactionId: createTransactionId(),
				key,
				node: overlay.node,
			},
		});

		const abortController = new AbortController();

		let response: Message<MessageBodyType.NODES_RESPONSE | MessageBodyType.VALUE_RESPONSE>;

		try {
			const [, resp] = await Promise.all([
				overlay.send(target, request.buffer, { ...options, signal: abortController.signal }),
				overlay.awaitResponse(
					{
						source: {
							nodeId: target.nodeId,
						},
						body: {
							types: [MessageBodyType.NODES_RESPONSE, MessageBodyType.VALUE_RESPONSE],
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

		switch (response.body.type) {
			case MessageBodyType.NODES_RESPONSE: {
				overlay.logger?.info(`Got ${response.body.nodes.length} nodes from target ${hex.encode(target.nodeId)}`);

				return uniqBy(response.body.nodes, (node) => hex.encode(node.nodeId))
					.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, key) - getBitwiseDistance(nodeB.nodeId, key))
					.slice(0, overlay.nodes.table.bucketSize);
			}
			case MessageBodyType.VALUE_RESPONSE: {
				overlay.logger?.info(`Found value with target ${hex.encode(target.nodeId)}`);

				values.push(response.body.value);

				return undefined;
			}
		}
	});

	return values.reduce<Value | undefined>((latestValue, value) => {
		return !latestValue?.signedAt || (value.signedAt && latestValue.signedAt <= value.signedAt) ? value : latestValue;
	}, undefined);
};
