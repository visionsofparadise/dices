import { compare } from "uint8array-tools";
import { Nodes } from "..";
import { Node } from "../../Node";

export const isValidDicesNode = (nodes: Nodes, node: Node) => {
	const id = nodes.table.getId(node);

	return (
		(node.diceAddress.ipv6 || node.diceAddress.ipv4) &&
		compare(id, nodes.table.id) !== 0 &&
		nodes.options.bootstrapTargets.every((bootstrapTarget) => compare(node.nodeId, bootstrapTarget.nodeId) !== 0)
	);
};
