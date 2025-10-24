import type { Overlay } from "..";
import { SignatureCodec } from "../../Keys/Codec";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";

export const handleOverlayFindNode = async (overlay: Overlay, request: Message<MessageBodyType.FIND_NODE>, context: Overlay.Context): Promise<void> => {
	const nodes = overlay.nodes.table.listClosestToId(request.body.nodeId);

	const response = new Message({
		body: {
			type: MessageBodyType.NODES_RESPONSE,
			transactionId: request.body.transactionId,
			nodes,
			node: overlay.node,
			reflectionAddress: context.remoteAddress,
			signature: new Uint8Array(SignatureCodec.byteLength()).fill(0),
		},
	});

	response.body.signature = overlay.keys.sign(response.hash);

	await overlay.diceClient.overlays[context.remoteAddress.type]?.send(context.remoteAddress, response.buffer);
};
