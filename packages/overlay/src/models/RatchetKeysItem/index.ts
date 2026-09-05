import { x25519 } from "@noble/curves/ed25519";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { createGetFromKeyHandler } from "../../utilities/createGetHandler";
import { createIterateHandler } from "../../utilities/createIterateHandler";
import { createPutHandler } from "../../utilities/createPutHandler";
import type { Item } from "../Item/index";
import { RatchetKeysItemKeyCodec, RatchetKeysItemValueCodec, type RatchetKeysItemKey, type RatchetKeysItemValue } from "./Codec";
import { createRatchetKeysKeyId } from "./methods/createKeyId";
import { MlKemSeedCodec } from "./MlKemCodec";
import { RatchetKeysPublic } from "./PublicCodec";

export namespace RatchetKeysItem {
	export interface Properties extends RatchetKeysItemKey, RatchetKeysItemValue {
		decryptionKey: Uint8Array;
		encryptionKey: Uint8Array;
		dhPublicKey: Uint8Array;
	}

	export interface Key extends Omit<RatchetKeysItemKey, "indexKey"> {}

	export type Public = RatchetKeysPublic;
}

export class RatchetKeysItem implements Item, RatchetKeysItem.Properties {
	static INDEX_KEY = Uint8Array.from([0x00]);

	static computeKeyId = createRatchetKeysKeyId;
	static get = createGetFromKeyHandler(RatchetKeysItemKeyCodec, RatchetKeysItemValueCodec, (properties) => new RatchetKeysItem(properties));
	static iterate = createIterateHandler(RatchetKeysItemKeyCodec, RatchetKeysItemValueCodec, (properties) => new RatchetKeysItem(properties));
	static keyOf(properties: RatchetKeysItem.Key): Uint8Array {
		return RatchetKeysItemKeyCodec.encode({ indexKey: RatchetKeysItem.INDEX_KEY, ...properties });
	}

	readonly keyId: Uint8Array;
	readonly dhSecretKey: Uint8Array;
	readonly dhPublicKey: Uint8Array;
	readonly mlKemSeed: Uint8Array;
	readonly encryptionKey: Uint8Array;
	readonly decryptionKey: Uint8Array;
	rotatedAt?: number;

	constructor(properties?: Partial<RatchetKeysItem.Properties>) {
		this.dhSecretKey = properties?.dhSecretKey || x25519.utils.randomSecretKey();
		this.dhPublicKey = x25519.getPublicKey(this.dhSecretKey);

		this.mlKemSeed = properties?.mlKemSeed || crypto.getRandomValues(new Uint8Array(MlKemSeedCodec.byteLength()));

		const mlKemKeypair = ml_kem1024.keygen(this.mlKemSeed);

		this.encryptionKey = mlKemKeypair.publicKey;
		this.decryptionKey = mlKemKeypair.secretKey;

		this.keyId = createRatchetKeysKeyId(this.encryptionKey, this.dhPublicKey);
		this.rotatedAt = properties?.rotatedAt;
	}

	get buffer(): Uint8Array {
		return RatchetKeysItemValueCodec.encode(this);
	}

	get byteLength(): number {
		return RatchetKeysItemValueCodec.byteLength(this);
	}

	get indexKey(): Uint8Array {
		return RatchetKeysItem.INDEX_KEY;
	}

	get key(): Uint8Array {
		return RatchetKeysItem.keyOf(this);
	}

	get properties(): RatchetKeysItem.Properties {
		const { indexKey, keyId, mlKemSeed, decryptionKey, encryptionKey, dhSecretKey, dhPublicKey } = this;

		return { indexKey, keyId, mlKemSeed, decryptionKey, encryptionKey, dhSecretKey, dhPublicKey };
	}

	get publicKeys(): RatchetKeysPublic {
		return {
			keyId: this.keyId,
			encryptionKey: this.encryptionKey,
			dhPublicKey: this.dhPublicKey,
		};
	}

	put = createPutHandler(this);
}
