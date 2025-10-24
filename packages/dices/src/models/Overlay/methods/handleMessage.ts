import { hex } from "@scure/base";
import type { Overlay } from "..";
import type { Message } from "../../Message";
import { MessageBodyType } from "../../Message/BodyCodec";

export const handleOverlayMessage = async (overlay: Overlay, message: Message, context: Overlay.Context): Promise<void> => {
	try {
		overlay.logger?.debug(`Handling message ${message.body.type} from ${context.remoteAddress.toString()}`);


		switch (message.body.type) {
			case MessageBodyType.PING: {
				overlay.handlePing(message as Message<MessageBodyType.PING>, context);

				break;
			}
			case MessageBodyType.FIND_NODE: {
				overlay.handleFindNode(message as Message<MessageBodyType.FIND_NODE>, context);

				break;
			}
			case MessageBodyType.FIND_VALUE: {
				overlay.handleFindValue(message as Message<MessageBodyType.FIND_VALUE>, context);

				break;
			}
			default: {

				switch (message.body.type) {
					case MessageBodyType.NODES_RESPONSE: {
						for (const node of message.body.nodes) overlay.nodes.putNode(node);

						break;
					}
				}

				const listenerKey = hex.encode(message.body.node.nodeId) + hex.encode(message.body.transactionId);
				const responseListener = overlay.responseListenerMap.get(listenerKey)?.listener;


				if (responseListener) {
					responseListener(message, context);
				} else {
				}

				break;
			}
		}

		if ("reflectionAddress" in message.body) {
			overlay.diceClient.overlays[message.body.reflectionAddress.type]?.handleReflection(context.remoteAddress, message.body.reflectionAddress);
		}

		overlay.diceClient.overlays[context.remoteAddress.type]?.handleAddress(context.remoteAddress);

		overlay.nodes.putNode(message.body.node);
		overlay.nodes.table.markSuccess(message.body.node.nodeId);
	} catch (error) {
		overlay.events.emit("error", error);
	}
};
