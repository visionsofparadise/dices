import { Message } from "..";
import { createHash } from "../../../utilities/Hash";
import { SignatureCodec } from "../../Keys/Codec";

export const hashMessage = (message: Message) => {
	if ("signature" in message.body) {
		return createHash(message.buffer.subarray(0, 0 - SignatureCodec.byteLength()));
	}

	return createHash(message.buffer);
};
