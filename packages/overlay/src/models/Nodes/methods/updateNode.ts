import { Nodes } from "..";
import { Node } from "../../Node";

export const updateDicesNode = (nodes: Nodes, nextNode: Node): boolean => {
	const id = nodes.table.getId(nextNode);

	const previousNode = nodes.table.get(id);

	if (!previousNode || nextNode.signedAt <= previousNode.signedAt) return false;

	nextNode.lastContactedAt = previousNode.lastContactedAt;

	const result = nodes.table.update(nextNode);

	if (result) {
		nodes.events.emit("update", previousNode, nextNode);
	}

	return result;
};
