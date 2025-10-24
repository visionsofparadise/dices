import { Nodes } from "..";
import { Node } from "../../Node";

export const addDicesNode = (nodes: Nodes, node: Node): boolean => {
	const result = nodes.table.add(node);

	if (result) {
		nodes.events.emit("add", node);
	}

	return result;
};
