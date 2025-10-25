import { compare } from "uint8array-tools";
import type { Overlay } from "..";
import { SignatureCodec } from "../../Keys/Codec";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";

export const handleOverlayFindValue = async (overlay: Overlay, request: Message<MessageBodyType.FIND_VALUE>, context: Overlay.Context): Promise<void> => {
	let response: Message<MessageBodyType.VALUE_RESPONSE | MessageBodyType.NODES_RESPONSE> | undefined;

	if (overlay.value && compare(request.body.key, overlay.keys.nodeId) === 0) {
		response = new Message({
			body: {
				type: MessageBodyType.VALUE_RESPONSE,
				transactionId: request.body.transactionId,
				value: overlay.value,
				node: overlay.node,
				reflectionAddress: context.remoteAddress,
				signature: new Uint8Array(SignatureCodec.byteLength()).fill(0),
			},
		});
	} else {
		const nodes = overlay.nodes.table.listClosestToId(request.body.key);

		response = new Message({
			body: {
				type: MessageBodyType.NODES_RESPONSE,
				transactionId: request.body.transactionId,
				nodes,
				node: overlay.node,
				reflectionAddress: context.remoteAddress,
				signature: new Uint8Array(SignatureCodec.byteLength()).fill(0),
			},
		});
	}

	response.body.signature = overlay.keys.sign(response.hash);

	try {
		await overlay.diceClient.overlays[context.remoteAddress.type]?.send(context.remoteAddress, response.buffer);
	} catch (error: any) {
		// ignore socket close errors during teardown
		if (error?.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') throw error;
	}
};
