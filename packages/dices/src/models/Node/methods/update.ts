import { compare } from "uint8array-tools";
import { Node } from "..";
import { Keys } from "../../Keys";

export const updateNode = (node: Node, properties: Partial<Omit<Node.Properties, "rSignature">>, keys: Keys): Node => {
	const updatedNode = new Node({
		...node.properties,
		...properties,
	});

	if (compare(node.hash, updatedNode.hash) === 0) return node;

	return Node.create(
		{
			diceAddress: node.diceAddress,
			signedAt: Date.now(),
			...properties,
		},
		keys
	);
};
