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

	/**
	 * Creates a new DICES Overlay instance for quantum-resistant encrypted P2P communication.
	 *
	 * @param options - Configuration options for the overlay
	 * @param options.database - LevelDB database instance for persistent storage
	 * @param options.diceClient - DICE client instance for DHT operations and peer discovery
	 * @param options.secretKey - Optional secp256k1 secret key (generates random if not provided)
	 * @param options.bootstrapTargets - Initial DHT nodes to connect to (defaults to BOOTSTRAP_TARGETS)
	 * @param options.concurrency - Number of concurrent DHT operations (default: 3)
	 * @param options.healthcheckIntervalMs - Interval for DHT healthchecks in ms (default: 60000)
	 * @param options.pruneIntervalMs - Interval for cleaning expired ratchet state in ms (default: 3600000)
	 * @param options.ratchetKeyTtl - Time-to-live for ratchet keys in ms (default: 3600000)
	 * @param options.timeoutMs - Default timeout for operations in ms (default: 30000)
	 *
	 * @example
	 * ```typescript
	 * const overlay = new Overlay({
	 *   database: new Level('./db'),
	 *   diceClient: new DiceClient({ ... }),
	 *   secretKey: mySecretKey // optional
	 * });
	 * ```
	 */
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

	/**
	 * Waits for a response message matching specific assertions.
	 *
	 * Creates a listener that resolves when a message is received matching the source nodeId,
	 * expected message types, and transactionId. Automatically times out if no matching response
	 * is received within the timeout period.
	 *
	 * @param assertions - Criteria for matching the expected response
	 * @param assertions.source.nodeId - Expected sender's nodeId
	 * @param assertions.body.types - Array of acceptable message types
	 * @param assertions.body.transactionId - Expected transaction ID
	 * @param options - Optional configuration
	 * @param options.timeoutMs - Override default timeout in milliseconds
	 * @param options.signal - AbortSignal to cancel waiting
	 * @param options.sendAbortController - AbortController to abort the associated send operation
	 * @returns Promise that resolves with the matching message
	 * @throws {DicesOverlayError} If request is aborted or times out
	 *
	 * @example
	 * ```typescript
	 * const response = await overlay.awaitResponse({
	 *   source: { nodeId: targetNodeId },
	 *   body: {
	 *     types: [MessageBodyType.SUCCESS_RESPONSE],
	 *     transactionId: requestTransactionId
	 *   }
	 * }, { timeoutMs: 5000 });
	 * ```
	 */
	awaitResponse = async <T extends MessageBodyType = MessageBodyType>(assertions: ResponseBodyAssertions<T>, options?: AwaitOverlayResponseOptions): Promise<Message<T>> => {
		return awaitOverlayResponse(this, assertions, options);
	};

	/**
	 * Closes the overlay, stopping all network operations and cleaning up resources.
	 *
	 * Stops healthcheck and prune intervals, removes event listeners, closes the DICE client
	 * and routing table, aborts all pending response listeners, and emits 'close' event.
	 *
	 * @example
	 * ```typescript
	 * overlay.close();
	 * ```
	 */
	close = closeOverlay.bind(this, this);

	/**
	 * Retrieves initiation keys for a remote peer from the DHT.
	 *
	 * Performs a DHT FIND_VALUE lookup to discover the remote peer's current ML-KEM-1024
	 * and X25519 public keys needed to initiate an encrypted session.
	 *
	 * @param remoteNodeId - The 20-byte nodeId of the remote peer
	 * @returns Promise resolving to the peer's initiation keys (keyId, encryptionKey, dhPublicKey)
	 * @throws {DicesOverlayError} If no initiation keys found for the nodeId
	 *
	 * @example
	 * ```typescript
	 * const initiationKeys = await overlay.getInitiationKeys(remoteNodeId);
	 * const envelope = await overlay.wrap(remoteNodeId, initiationKeys, data);
	 * ```
	 */
	getInitiationKeys = getOverlayInitiationKeys.bind(this, this);
	healthcheck = healthcheckOverlay.bind(this, this);
	loadRatchetKeys = loadOverlayRatchetKeys.bind(this, this);

	/**
	 * Opens the overlay and starts network operations.
	 *
	 * Opens the database, connects the DICE client to the network, loads or generates ratchet keys,
	 * publishes initiation keys to the DHT, and starts healthcheck and prune intervals.
	 *
	 * @param isBootstrapping - Whether to connect to bootstrap nodes (default: true)
	 * @returns Promise that resolves when overlay is fully opened
	 *
	 * @example
	 * ```typescript
	 * await overlay.open();
	 * // Overlay is now ready for encrypted communication
	 * ```
	 */
	open = openOverlay.bind(this, this);
	prune = pruneOverlay.bind(this, this);
	rotate = rotateOverlayKeys.bind(this, this);

	/**
	 * Sends a raw buffer to a target peer via DICE protocol.
	 *
	 * Low-level send method that transmits data over IPv6 or IPv4 depending on availability.
	 * Typically used internally - most applications should use wrap() for encrypted sends.
	 *
	 * @param target - Target peer with nodeId and diceAddress
	 * @param buffer - Raw data to send
	 * @param options - Optional send options (signal for cancellation)
	 * @returns Promise that resolves when send completes
	 * @throws {DicesOverlayError} If overlay is closed or no valid address found
	 *
	 * @example
	 * ```typescript
	 * await overlay.send(target, messageBuffer);
	 * ```
	 */
	send = sendOverlay.bind(this, this);


	handleBuffer = handleOverlayBuffer.bind(this, this);
	handleFindNode = handleOverlayFindNode.bind(this, this);
	handleFindValue = handleOverlayFindValue.bind(this, this);
	handleMessage = handleOverlayMessage.bind(this, this);
	handlePing = handleOverlayPing.bind(this, this);

	/**
	 * Performs a DHT FIND_VALUE lookup to retrieve a value stored at a key.
	 *
	 * Executes concurrent lookups across multiple peers, iteratively querying closer nodes
	 * until the value is found or timeout occurs. Returns the most recent value if multiple
	 * peers respond with different versions.
	 *
	 * @param key - The 20-byte key to lookup (typically a nodeId)
	 * @param options - Optional timeout and send options
	 * @returns Promise resolving to the value if found, undefined otherwise
	 *
	 * @example
	 * ```typescript
	 * const value = await overlay.findValue(remoteNodeId);
	 * if (value) {
	 *   console.log('Found initiation keys:', value.initiationKeys);
	 * }
	 * ```
	 */
	findValue = sendOverlayFindValue.bind(this, this);

	/**
	 * Performs a DHT FIND_NODE lookup to discover peers close to a target nodeId.
	 *
	 * Executes concurrent lookups across multiple peers, iteratively querying closer nodes
	 * until convergence or timeout. Returns up to bucketSize closest nodes sorted by XOR distance.
	 *
	 * @param nodeId - The 20-byte nodeId to search for
	 * @param options - Optional timeout and send options
	 * @returns Promise resolving to array of closest nodes found
	 *
	 * @example
	 * ```typescript
	 * const closestNodes = await overlay.findNode(targetNodeId);
	 * console.log(`Found ${closestNodes.length} nodes near target`);
	 * ```
	 */
	findNode = sendOverlayFindNode.bind(this, this);

	/**
	 * Sends a PING request to a target peer and waits for SUCCESS_RESPONSE.
	 *
	 * Used for peer liveness checks, RTT measurement, and verifying peer identity.
	 * Validates the response signature before returning the peer's node information.
	 *
	 * @param target - Target peer to ping
	 * @param options - Optional timeout and send options
	 * @returns Promise resolving to the peer's authenticated node information
	 * @throws {DicesOverlayError} If ping fails, times out, or signature verification fails
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const node = await overlay.ping(target);
	 *   console.log('Peer is alive:', node.nodeId);
	 * } catch (error) {
	 *   console.error('Peer unreachable');
	 * }
	 * ```
	 */
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
