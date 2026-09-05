import { Nodes } from "..";

export const closeDices = (nodes: Nodes): void => {
	nodes.table.clear();

	nodes.state = Nodes.STATE.CLOSED;
	nodes.events.emit("close");
};
