import { KademliaTable } from "kademlia-table";
import { Node } from "../Node";

export class RoutingTable extends KademliaTable<Node> {
	constructor(
		public readonly nodeId: Uint8Array,
		options?: Omit<KademliaTable.Options<Node>, "getId">
	) {
		super(nodeId, {
			...options,
			getId(node) {
				return node.nodeId;
			},
		});
	}

	markSuccess(id: Uint8Array, d?: number): boolean {
		const node = this.get(id, d);

		if (node) node.lastContactedAt = Date.now();

		return super.markSuccess(id, d);
	}
}
