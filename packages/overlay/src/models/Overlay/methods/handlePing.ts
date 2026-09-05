import type { Overlay } from "..";
import { SignatureCodec } from "../../Keys/Codec";
import { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";

export const handleOverlayPing = async (overlay: Overlay, request: Message<MessageBodyType.PING>, context: Overlay.Context): Promise<void> => {

	const response = new Message({
		body: {
			type: MessageBodyType.SUCCESS_RESPONSE,
			transactionId: request.body.transactionId,
			reflectionAddress: context.remoteAddress,
			node: overlay.node,
			signature: new Uint8Array(SignatureCodec.byteLength()).fill(0),
		},
	});

	response.body.signature = overlay.keys.sign(response.hash);


	try {
		await overlay.diceClient.overlays[context.remoteAddress.type]?.send(context.remoteAddress, response.buffer);
	} catch (error: any) {
		// ignore socket close errors during teardown
		if (error?.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') throw error;
	}

};
