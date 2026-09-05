import { DiceAddress, RequiredProperties } from "@xkore/dice";
import { createCheck } from "../../utilities/check";
import { createChecksum, createShortHash } from "../../utilities/Hash";
import { Keys } from "../Keys";
import { RSignature } from "../Keys/Codec";
import { Target } from "../Target/Codec";
import { NodeCodec, NodeProperties } from "./Codec";
import { createNode } from "./methods/create";
import { hashNode } from "./methods/hash";
import { updateNode } from "./methods/update";

export namespace Node {
	export type Properties = NodeProperties;

	export interface Cache {
		buffer?: Uint8Array;
		byteLength?: number;
		checksum?: Uint8Array;
		hash?: Uint8Array;
		nodeId?: Uint8Array;
		nodeIdCheck?: Uint8Array;
		publicKey?: Uint8Array;
	}
}

export class Node implements Node.Properties, Target {
	static create = createNode;
	static hash = hashNode;

	readonly diceAddress: DiceAddress;
	readonly signedAt: number;
	readonly rSignature: RSignature;

	lastContactedAt?: number;

	constructor(
		properties: RequiredProperties<Node.Properties, "diceAddress" | "rSignature">,
		public cache: Node.Cache = {}
	) {
		this.diceAddress = properties.diceAddress;
		this.signedAt = properties.signedAt || Date.now();
		this.rSignature = properties.rSignature;
	}

	get buffer(): Uint8Array {
		return this.cache.buffer || (this.cache.buffer = NodeCodec.encode(this));
	}

	get byteLength(): number {
		return this.cache.byteLength || (this.cache.byteLength = NodeCodec.byteLength(this));
	}

	get checksum(): Uint8Array {
		return this.cache.checksum || (this.cache.checksum = createChecksum(this.buffer));
	}

	get hash(): Uint8Array {
		return this.cache.hash || (this.cache.hash = Node.hash(this));
	}

	get nodeId(): Uint8Array {
		return this.cache.nodeId || (this.cache.nodeId = createShortHash(this.publicKey));
	}

	get nodeIdCheck(): Uint8Array {
		return this.cache.nodeIdCheck || (this.cache.nodeIdCheck = createCheck(this.nodeId));
	}

	get properties(): Node.Properties {
		const { diceAddress, signedAt, rSignature } = this;

		return { diceAddress, signedAt, rSignature };
	}

	get publicKey(): Uint8Array {
		return this.cache.publicKey || (this.cache.publicKey = Keys.recover(this.rSignature, this.hash));
	}

	update = updateNode.bind(this, this);
}
