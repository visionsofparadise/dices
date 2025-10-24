import { secp256k1 } from "@noble/curves/secp256k1";
import { Address, DiceAddress, Client as DiceClient, EventEmitterOptions, Logger, RequiredProperties, wrapLogger } from "@xkore/dice";
import { RemoteInfo } from "dgram";
import EventEmitter from "events";
import type { Level } from "level";
import { defaults } from "lodash-es";
import { compare } from "uint8array-tools";
import { BOOTSTRAP_TARGETS } from "../../utilities/bootstrapTargets";
import { Keys } from "../Keys";
import { Message } from "../Message";
import { MessageBodyType } from "../Message/BodyCodec";
import { Node } from "../Node";
import { Nodes } from "../Nodes";
import { RatchetKeysItem } from "../RatchetKeysItem";
import { Target } from "../Target/Codec";
import { Value } from "../Value";
import { awaitOverlayResponse, AwaitOverlayResponseOptions, ResponseBodyAssertions } from "./methods/awaitResponse";
import { closeOverlay } from "./methods/close";
import { getOverlayInitiationKeys } from "./methods/getInitiationKeys";
import { handleOverlayBuffer } from "./methods/handleBuffer";
import { handleOverlayFindNode } from "./methods/handleFindNode";
import { handleOverlayFindValue } from "./methods/handleFindValue";
import { handleOverlayMessage } from "./methods/handleMessage";
import { handleOverlayPing } from "./methods/handlePing";
import { healthcheckOverlay } from "./methods/healthcheck";
import { loadOverlayRatchetKeys } from "./methods/loadRatchetKeys";
import { openOverlay } from "./methods/open";
import { pruneOverlay } from "./methods/prune";
import { rotateOverlayKeys } from "./methods/rotateKeys";
import { sendOverlay } from "./methods/send";
import { sendOverlayFindNode } from "./methods/sendFindNode";
import { sendOverlayFindValue } from "./methods/sendFindValue";
import { sendOverlayPing } from "./methods/sendPing";
import { unwrapOverlayEnvelope } from "./methods/unwrap";
import { wrapOverlayEnvelope } from "./methods/wrap";

export namespace Overlay {
	export interface EventMap {
		close: [];
		error: [error: unknown];
		message: [message: Message, context: Overlay.Context];
		node: [previousNode: Node, nextNode: Node];
		open: [];
		rotate: [initiationKeys: RatchetKeysItem];
	}

	export interface Options extends EventEmitterOptions {
		bootstrapTargets: Array<Target>;
		concurrency: number;
		database: Level<Uint8Array, Uint8Array>;
		diceClient: DiceClient;
		healthcheckIntervalMs: number;
		logger?: Logger;
		pruneIntervalMs: number;
		ratchetKeyTtl: number;
		secretKey: Uint8Array;
		timeoutMs: number;
	}

	export interface Context {
		buffer: Uint8Array;
		overlay: Overlay;
		remoteInfo: RemoteInfo;
		remoteAddress: Address;
	}

	export type State = 0 | 1;
}

export class Overlay {
	static STATE = {
		CLOSED: 0,
		OPENED: 1,
	} as const;

	public database: Level<Uint8Array, Uint8Array>;
	public diceClient: DiceClient;
	public events: EventEmitter<Overlay.EventMap>;
	public healthcheckInterval?: NodeJS.Timeout;
	public isHealthchecking = false;
	public keys: Keys;
	public logger?: Logger;
	public nodes: Nodes;
	public options: Overlay.Options;
	public pruneInterval?: NodeJS.Timeout;
	public responseListenerMap = new Map<string, { abort: AbortController; listener: (message: Message, context: Overlay.Context) => any }>();
	public state: Overlay.State = Overlay.STATE.CLOSED;

	currentRatchetKeys?: RatchetKeysItem;
	value?: Value;

	constructor(options: RequiredProperties<Overlay.Options, "database" | "diceClient">) {
		const defaultOptions = defaults(options, {
			bootstrapTargets: BOOTSTRAP_TARGETS,
			concurrency: options?.diceClient?.options.concurrency || 3,
			healthcheckIntervalMs: 60_000,
			pruneIntervalMs: 3_600_000,
			ratchetKeyTtl: 3_600_000,
			secretKey: secp256k1.utils.randomSecretKey(),
			timeoutMs: 30_000,
		});

		this.database = defaultOptions.database;
		this.diceClient = defaultOptions.diceClient;
		this.events = new EventEmitter(defaultOptions);
		this.keys = new Keys(defaultOptions);
		this.logger = wrapLogger(defaultOptions.logger, `DICES OVERLAY ${this.keys.nodeId.slice(-4)}`);
		this._node = Node.create(
			{
				diceAddress: this.diceClient.diceAddress,
			},
			this.keys
		);
		this.node = this._node;
		this.nodes = new Nodes(defaultOptions);
		this.options = defaultOptions;
	}

	awaitResponse = async <T extends MessageBodyType = MessageBodyType>(assertions: ResponseBodyAssertions<T>, options?: AwaitOverlayResponseOptions): Promise<Message<T>> => {
		return awaitOverlayResponse(this, assertions, options);
	};

	close = closeOverlay.bind(this, this);
	getInitiationKeys = getOverlayInitiationKeys.bind(this, this);
	healthcheck = healthcheckOverlay.bind(this, this);
	loadRatchetKeys = loadOverlayRatchetKeys.bind(this, this);
	open = openOverlay.bind(this, this);
	prune = pruneOverlay.bind(this, this);
	rotate = rotateOverlayKeys.bind(this, this);
	send = sendOverlay.bind(this, this);
	unwrap = unwrapOverlayEnvelope.bind(this, this);
	wrap = wrapOverlayEnvelope.bind(this, this);

	handleBuffer = handleOverlayBuffer.bind(this, this);
	handleFindNode = handleOverlayFindNode.bind(this, this);
	handleFindValue = handleOverlayFindValue.bind(this, this);
	handleMessage = handleOverlayMessage.bind(this, this);
	handlePing = handleOverlayPing.bind(this, this);

	findValue = sendOverlayFindValue.bind(this, this);
	findNode = sendOverlayFindNode.bind(this, this);
	ping = sendOverlayPing.bind(this, this);

	diceClientListeners = {
		diceAddressListener: (diceAddress: DiceAddress) => {
			this.node = this.node.update(
				{
					diceAddress,
				},
				this.keys
			);
		},
		messageListener: (message: Uint8Array, remoteInfo: RemoteInfo) => {
			this.handleBuffer(message, {
				remoteInfo,
			});
		},
	};

	clientListeners = {
		errorListener: (error: unknown) => {
			if (this.state !== Overlay.STATE.OPENED) return;

			this.logger?.error(error);
		},
		messageListener: (message: Message, context: Overlay.Context) => {
			this.handleMessage(message, context).catch((error) => {
				if (this.state !== Overlay.STATE.CLOSED) {
					this.events.emit("error", error);
				}
			});
		},
	};

	private _node: Node;

	get node() {
		return this._node;
	}

	set node(nextNode: Node) {
		const previousNode = this.node;

		if (compare(previousNode.checksum, nextNode.checksum) === 0) return;

		this._node = nextNode;

		this.events.emit("node", previousNode, nextNode);
	}
}
