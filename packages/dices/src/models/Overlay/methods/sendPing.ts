import { hex } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { defaults } from "lodash-es";
import type { Overlay } from "..";
import { DicesOverlayError } from "../../Error";
import { Keys } from "../../Keys";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";
import type { Node } from "../../Node";
import type { Target } from "../../Target/Codec";
import { createTransactionId } from "../../TransactionId/Codec";
import type { AwaitOverlayResponseOptions } from "./awaitResponse";

export const sendOverlayPing = async (overlay: Overlay, target: Target, options?: AwaitOverlayResponseOptions & SendClientAddressOptions): Promise<Node> => {
	overlay.logger?.info(`Pinging node at ${hex.encode(target.nodeId)}`);

	const request = new Message({
		body: {
			type: MessageBodyType.PING,
			transactionId: createTransactionId(),
			node: overlay.node,
		},
	});

	try {
		const abortController = new AbortController();

		const [_, response] = await Promise.all([
			overlay.send(target, request.buffer, { ...options, signal: abortController.signal }),
			overlay.awaitResponse(
				{
					source: {
						nodeId: target.nodeId,
					},
					body: {
						types: [MessageBodyType.SUCCESS_RESPONSE],
						transactionId: request.body.transactionId,
					},
				},
				defaults({ ...options, sendAbortController: abortController }, overlay.options)
			),
		]);

		if (!Keys.isVerified(response.body.signature, response.hash, response.body.node.publicKey)) throw new DicesOverlayError("Unauthorized response");

		return response.body.node;
	} catch (error) {
		overlay.nodes.table.markError(target.nodeId);
		overlay.events.emit("error", error);

		throw error;
	}
};
