import { Codec } from "bufferfy";
import { Value } from ".";
import { NodeIdCodec, RSignatureCodec } from "../Keys/Codec";
import { RatchetKeysPublicCodec } from "../RatchetKeysItem/PublicCodec";

export const KeyCodec = NodeIdCodec;

export const ValuePropertiesCodec = Codec.Object({
	initiationKeys: RatchetKeysPublicCodec,
	rSignature: RSignatureCodec,
	signedAt: Codec.VarInt(60),
});

export interface ValueProperties extends Codec.Type<typeof ValuePropertiesCodec> {}

export const ValueCodec = Codec.Transform(ValuePropertiesCodec, {
	isValid: (value) => value instanceof Value,
	decode: (properties, buffer) => new Value(properties, { buffer, byteLength: buffer.byteLength }),
	encode: (value) => value.properties,
});
