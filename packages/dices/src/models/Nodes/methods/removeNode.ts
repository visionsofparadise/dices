import { Nodes } from "..";
import { Node } from "../../Node";

export const removeDicesNode = (nodes: Nodes, node: Node): boolean => {
	const id = nodes.table.getId(node);

	const result = nodes.table.remove(id);

	if (result) {
		nodes.events.emit("remove", node);
	}

	return result;
};
