import { RequiredProperties } from "@xkore/dice";
import { createCheck } from "../../utilities/check";
import { createChecksum, createShortHash } from "../../utilities/Hash";
import { MAGIC_BYTES } from "../../utilities/magicBytes";
import { CipherData } from "../CipherData";
import { Keys } from "../Keys";
import { RSignature } from "../Keys/Codec";
import { EnvelopeCodec, EnvelopeProperties } from "./Codec";
import { createEnvelope } from "./methods/create";
import { decryptEnvelope } from "./methods/decrypt";
import { encryptEnvelope } from "./methods/encrypt";
import { hashEnvelope } from "./methods/hash";
import { updateEnvelope } from "./methods/update";

export type { EncryptOptions } from "./methods/encrypt";

export namespace Envelope {
	export interface Properties extends EnvelopeProperties {
		magicBytes: Uint8Array;
		version: number;
		keyId: Uint8Array;
		dhPublicKey: Uint8Array;
		messageNumber: number;
		previousChainLength: number;
		kemCiphertext?: Uint8Array;
		cipherData: CipherData;
		rSignature: RSignature;
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

export class Envelope implements Envelope.Properties {
	static create = createEnvelope;
	static encrypt = encryptEnvelope;
	static hash = hashEnvelope;

	readonly magicBytes = MAGIC_BYTES;
	readonly version = 0x01;
	readonly keyId: Uint8Array;
	readonly dhPublicKey: Uint8Array;
	readonly messageNumber: number;
	readonly previousChainLength: number;
	readonly kemCiphertext?: Uint8Array;
	readonly cipherData: CipherData;
	readonly rSignature: RSignature;

	constructor(
		properties: RequiredProperties<Envelope.Properties, "keyId" | "dhPublicKey" | "messageNumber" | "previousChainLength" | "cipherData" | "rSignature">,
		public cache: Envelope.Cache = {}
	) {
		this.keyId = properties.keyId;
		this.dhPublicKey = properties.dhPublicKey;
		this.messageNumber = properties.messageNumber;
		this.previousChainLength = properties.previousChainLength;
		this.kemCiphertext = properties.kemCiphertext;
		this.cipherData = properties.cipherData;
		this.rSignature = properties.rSignature;
	}

	get buffer(): Uint8Array {
		return this.cache.buffer || (this.cache.buffer = EnvelopeCodec.encode(this));
	}

	get byteLength(): number {
		return this.cache.byteLength || (this.cache.byteLength = EnvelopeCodec.byteLength(this));
	}

	get checksum(): Uint8Array {
		return this.cache.checksum || (this.cache.checksum = createChecksum(this.buffer));
	}

	get hash(): Uint8Array {
		return this.cache.hash || (this.cache.hash = Envelope.hash(this));
	}

	get publicKey(): Uint8Array {
		return this.cache.publicKey || (this.cache.publicKey = Keys.recover(this.rSignature, this.hash));
	}

	get nodeId(): Uint8Array {
		return this.cache.nodeId || (this.cache.nodeId = createShortHash(this.publicKey));
	}

	get nodeIdCheck(): Uint8Array {
		return this.cache.nodeIdCheck || (this.cache.nodeIdCheck = createCheck(this.nodeId));
	}

	get properties(): Envelope.Properties {
		const { magicBytes, version, keyId, dhPublicKey, messageNumber, previousChainLength, kemCiphertext, cipherData, rSignature } = this;

		return {
			magicBytes,
			version,
			keyId,
			dhPublicKey,
			messageNumber,
			previousChainLength,
			kemCiphertext,
			cipherData,
			rSignature,
		};
	}

	update = updateEnvelope.bind(this, this);
	decrypt = decryptEnvelope.bind(this, this);
}
