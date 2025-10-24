import { hex } from "@scure/base";
import type { Overlay } from "..";
import { DicesOverlayError } from "../../Error";
import type { Message } from "../../Message";
import type { MessageBodyType } from "../../Message/BodyCodec";

export interface AwaitOverlayResponseOptions {
	sendAbortController?: AbortController;
	signal?: AbortSignal;
	timeoutMs?: number;
}

export interface ResponseBodyAssertions<T extends MessageBodyType> {
	source: {
		nodeId: Uint8Array;
	};
	body: {
		types: Array<T>;
		transactionId: Uint8Array;
	};
}

export const awaitOverlayResponse = async <T extends MessageBodyType = MessageBodyType>(
	overlay: Overlay,
	assertions: ResponseBodyAssertions<T>,
	options?: AwaitOverlayResponseOptions
): Promise<Message<T>> => {
	return new Promise<Message<T>>((resolve, reject) => {
		if (options?.signal?.aborted) return reject(new DicesOverlayError("Awaiting response aborted"));

		const internalAbort = new AbortController();
		const key = hex.encode(assertions.source.nodeId) + hex.encode(assertions.body.transactionId);


		let abortListener: (() => void) | undefined;
		let responseListener: ((message: Message, context: Overlay.Context) => void) | undefined;
		let timeout: NodeJS.Timeout | undefined;

		const clearListeners = () => {
			if (options?.sendAbortController) options.sendAbortController.abort();
			if (abortListener) {
				options?.signal?.removeEventListener("abort", abortListener);
				internalAbort.signal.removeEventListener("abort", abortListener);
			}
			if (responseListener) overlay.responseListenerMap.delete(key);
			if (timeout) clearTimeout(timeout);
		};

		abortListener = () => {
			clearListeners();

			reject(new DicesOverlayError("Awaiting response aborted"));
		};

		options?.signal?.addEventListener("abort", abortListener);
		internalAbort.signal.addEventListener("abort", abortListener);

		responseListener = (response: Message) => {
			if (!assertions.body.types.includes(response.body.type as any)) {
				return;
			}

			clearListeners();
			resolve(response as Message<T>);
		};

		overlay.responseListenerMap.set(key, {
			abort: internalAbort,
			listener: responseListener,
		});


		timeout = setTimeout(() => {
			clearListeners();

			reject(new DicesOverlayError("Awaiting response timed out"));
		}, options?.timeoutMs || overlay.options.timeoutMs);
	});
};
