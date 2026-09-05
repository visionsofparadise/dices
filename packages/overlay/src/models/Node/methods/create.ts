import { RequiredProperties } from "@xkore/dice";
import { Node } from "..";
import { Keys } from "../../Keys";

export const createNode = (properties: RequiredProperties<Node.Properties, "diceAddress">, keys: Keys): Node => {
	const defaultProperties: Omit<Node.Properties, "rSignature"> = {
		diceAddress: properties.diceAddress,
		signedAt: properties.signedAt || Date.now(),
	};

	const hash = Node.hash(defaultProperties);

	const rSignature = keys.rSign(hash);

	const node = new Node(
		{
			...defaultProperties,
			rSignature,
		},
		{
			hash,
			nodeId: keys.nodeId,
			nodeIdCheck: keys.nodeIdCheck,
			publicKey: keys.publicKey,
		}
	);

	return node;
};
