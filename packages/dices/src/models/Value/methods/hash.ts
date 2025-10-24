import { Codec } from "bufferfy";
import { Value } from "..";
import { createHash } from "../../../utilities/Hash";
import { ValuePropertiesCodec } from "../Codec";

export const hashValue = (properties: Omit<Value.Properties, "rSignature">): Uint8Array => {
	return createHash(Codec.Omit(ValuePropertiesCodec, ["rSignature"]).encode(properties));
};
