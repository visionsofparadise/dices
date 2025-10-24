import { createCheck } from "../../utilities/check";
import { createChecksum, createShortHash } from "../../utilities/Hash";
import { Keys } from "../Keys";
import type { RSignature } from "../Keys/Codec";
import { RatchetKeysPublic } from "../RatchetKeysItem/PublicCodec";
import { ValueCodec } from "./Codec";
import { createValue } from "./methods/create";
import { hashValue } from "./methods/hash";
import { updateValue } from "./methods/update";

export namespace Value {
	export interface Properties {
		initiationKeys: RatchetKeysPublic;
		rSignature: RSignature;
		signedAt: number;
	}

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

export class Value implements Value.Properties {
	static create = createValue;
	static hash = hashValue;
	static update = updateValue;

	readonly initiationKeys: RatchetKeysPublic;
	readonly rSignature: RSignature;
	readonly signedAt: number;

	constructor(
		properties: Value.Properties,
		public cache: Value.Cache = {}
	) {
		this.initiationKeys = properties.initiationKeys;
		this.rSignature = properties.rSignature;
		this.signedAt = properties.signedAt;
	}

	get buffer(): Uint8Array {
		return this.cache.buffer || (this.cache.buffer = ValueCodec.encode(this));
	}

	get byteLength(): number {
		return this.cache.byteLength || (this.cache.byteLength = ValueCodec.byteLength(this));
	}

	get checksum(): Uint8Array {
		return this.cache.checksum || (this.cache.checksum = createChecksum(this.buffer));
	}

	get hash(): Uint8Array {
		return this.cache.hash || (this.cache.hash = Value.hash(this));
	}

	get nodeId(): Uint8Array {
		return this.cache.nodeId || (this.cache.nodeId = createShortHash(this.publicKey));
	}

	get nodeIdCheck(): Uint8Array {
		return this.cache.nodeIdCheck || (this.cache.nodeIdCheck = createCheck(this.nodeId));
	}

	get properties(): Value.Properties {
		const { initiationKeys, rSignature, signedAt } = this;

		return { initiationKeys, rSignature, signedAt };
	}

	get publicKey(): Uint8Array {
		return this.cache.publicKey || (this.cache.publicKey = Keys.recover(this.rSignature, this.hash));
	}
}
