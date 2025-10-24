import { Address, RequiredProperties } from "@xkore/dice";
import { compare } from "uint8array-tools";
import { Overlay } from "..";
import { MAGIC_BYTES } from "../../../utilities/magicBytes";
import { MessageCodec, VERSION } from "../../Message/Codec";

export const handleOverlayBuffer = (overlay: Overlay, buffer: Uint8Array, context: RequiredProperties<Overlay.Context, "remoteInfo">): void => {
	try {
		if (overlay.state !== Overlay.STATE.OPENED) {
			return;
		}

		const receivedMagicBytes = buffer.subarray(0, MAGIC_BYTES.byteLength);
		if (compare(receivedMagicBytes, MAGIC_BYTES) !== 0) {
			return;
		}

		const version = buffer.at(MAGIC_BYTES.byteLength);

		if (version === undefined || version > VERSION.V0) {
			return;
		}


		overlay.logger?.debug(`Received ${buffer.byteLength} bytes`);

		const remoteAddress = Address.fromAddressInfo(context.remoteInfo);
		const message = MessageCodec.decode(buffer);


		overlay.events.emit("message", message, {
			...context,
			buffer,
			overlay,
			remoteAddress,
		});
	} catch (error) {
		overlay.events.emit("error", error);
	}
};
