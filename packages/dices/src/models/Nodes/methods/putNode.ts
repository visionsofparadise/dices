import { Nodes } from "..";
import { Node } from "../../Node";

export const putDicesNode = (nodes: Nodes, node: Node): boolean => {
	if (!nodes.isValidNode(node)) return false;

	const id = nodes.table.getId(node);

	if (nodes.table.has(id)) {
		return nodes.updateNode(node);
	} else {
		return nodes.addNode(node);
	}
};
