import { Codec } from "bufferfy";
import { MAGIC_BYTES } from "../../utilities/magicBytes";
import { Message } from ".";
import { MessageBodyCodec } from "./BodyCodec";

export const VERSION = {
	V0: 0,
} as const;

export const MessagePropertiesCodec = Codec.Object({
	magicBytes: Codec.Bytes(MAGIC_BYTES.byteLength),
	version: Codec.UInt(8),
	body: MessageBodyCodec,
});

export interface MessageProperties extends Codec.Type<typeof MessagePropertiesCodec> {}

export const MessageCodec = Codec.Transform(MessagePropertiesCodec, {
	isValid: (value) => value instanceof Message,
	decode: (properties) => new Message(properties),
	encode: (message) => message.properties,
});
