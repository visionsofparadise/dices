import { Codec } from "bufferfy";
import { Node } from "..";
import { createHash } from "../../../utilities/Hash";
import { NodePropertiesCodec } from "../Codec";

export const hashNode = (properties: Omit<Node.Properties, "rSignature">) => {
	return createHash(Codec.Omit(NodePropertiesCodec, ["rSignature"]).encode(properties));
};
