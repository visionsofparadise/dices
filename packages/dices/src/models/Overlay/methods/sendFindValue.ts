import { hex } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { getBitwiseDistance } from "kademlia-table";
import { defaults, sampleSize, uniqBy } from "lodash-es";
import type { Overlay } from "..";
import { Timeout } from "../../../utilities/Timeout";
import { DicesOverlayError } from "../../Error";
import { Keys } from "../../Keys";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";
import type { Node } from "../../Node";
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

	const history = new Set<string>();
	const timeout = new Timeout(options?.timeoutMs || overlay.options.timeoutMs);

	let results: Array<PromiseSettledResult<Value>> = [];

	const promises = initialTargets.map(async (initialTarget) => {
		let distance = getBitwiseDistance(initialTarget.nodeId, key);
		let nodes: Array<Node> = [];
		let target: Target | undefined = initialTarget;

		while (target && !timeout.isExpired) {
			try {
				history.add(hex.encode(target.nodeId));

				overlay.logger?.info(`Finding with target ${hex.encode(target.nodeId)}`);

				const request = new Message({
					body: {
						type: MessageBodyType.FIND_VALUE,
						transactionId: createTransactionId(),
						key,
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
								types: [MessageBodyType.NODES_RESPONSE, MessageBodyType.VALUE_RESPONSE],
								transactionId: request.body.transactionId,
							},
						},
						defaults({ ...options, sendAbortController: abortController }, overlay.options)
					),
				]);

				if (!Keys.isVerified(response.body.signature, response.hash, response.body.node.publicKey)) throw new DicesOverlayError("Unauthorized response");

				distance = getBitwiseDistance(target.nodeId, key);

				switch (response.body.type) {
					case MessageBodyType.NODES_RESPONSE: {
						overlay.logger?.info(`Got ${response.body.nodes.length} nodes from target ${hex.encode(target.nodeId)}`);

						nodes = uniqBy(nodes.concat(response.body.nodes), (node) => hex.encode(node.nodeId))
							.sort((nodeA, nodeB) => getBitwiseDistance(nodeA.nodeId, key) - getBitwiseDistance(nodeB.nodeId, key))
							.slice(0, overlay.nodes.table.bucketSize);

						break;
					}
					case MessageBodyType.VALUE_RESPONSE: {
						overlay.logger?.info(`Found value with target ${hex.encode(target.nodeId)}`);

						return response.body.value;
					}
				}
			} catch (error) {
				overlay.nodes.table.markError(target.nodeId);
				overlay.events.emit("error", error);
			}

			target = nodes.find((node) => !!node.diceAddress && !history.has(hex.encode(node.nodeId)) && getBitwiseDistance(node.nodeId, key) < distance);
		}

		throw new DicesOverlayError("Could not find value");
	});

	if (promises.length) results = await Promise.allSettled(promises);

	return results.reduce<Value | undefined>((latestValue, result) => {
		return result.status === "fulfilled" && (!latestValue?.signedAt || (result.value.signedAt && latestValue.signedAt <= result.value.signedAt)) ? result.value : latestValue;
	}, undefined);
};
