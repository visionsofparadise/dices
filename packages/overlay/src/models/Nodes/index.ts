import { secp256k1 } from "@noble/curves/secp256k1";
import { EventEmitterOptions, Logger, wrapLogger } from "@xkore/dice";
import EventEmitter from "events";
import { defaults } from "lodash-es";
import { BOOTSTRAP_TARGETS } from "../../utilities/bootstrapTargets";
import { Keys } from "../Keys";
import { Node } from "../Node";
import { RoutingTable } from "../RoutingTable";
import { Target } from "../Target/Codec";
import { addDicesNode } from "./methods/addNode";
import { closeDices } from "./methods/close";
import { isValidDicesNode } from "./methods/isValidNode";
import { putDicesNode } from "./methods/putNode";
import { removeDicesNode } from "./methods/removeNode";
import { updateDicesNode } from "./methods/updateNode";

export namespace Nodes {
	export interface EventMap {
		add: [Node];
		close: [];
		open: [];
		remove: [Node];
		update: [Node, Node];
	}

	export interface Options extends EventEmitterOptions {
		bootstrapTargets: Array<Target>;
		logger?: Logger;
		secretKey?: Uint8Array;
	}

	export type State = 0 | 1;
}

export class Nodes {
	static STATE = {
		CLOSED: 0,
		OPENED: 1,
	} as const;

	public events: EventEmitter<Nodes.EventMap>;
	public keys: Keys;
	public logger?: Logger;
	public options: Nodes.Options;
	public state: Nodes.State = Nodes.STATE.CLOSED;
	public table: RoutingTable;

	constructor(options?: Partial<Nodes.Options>) {
		const defaultOptions = defaults(
			{ ...options },
			{
				bootstrapTargets: BOOTSTRAP_TARGETS,
				secretKey: secp256k1.utils.randomSecretKey(),
			}
		);

		this.events = new EventEmitter(defaultOptions);
		this.keys = new Keys(defaultOptions);
		this.logger = wrapLogger(defaultOptions.logger, `DICES NODES`);
		this.options = defaultOptions;
		this.table = new RoutingTable(this.keys.nodeId);

		this.state = Nodes.STATE.OPENED;
		this.events.emit("open");
	}

	addNode = addDicesNode.bind(this, this);
	close = closeDices.bind(this, this);
	isValidNode = isValidDicesNode.bind(this, this);
	putNode = putDicesNode.bind(this, this);
	removeNode = removeDicesNode.bind(this, this);
	updateNode = updateDicesNode.bind(this, this);
}
