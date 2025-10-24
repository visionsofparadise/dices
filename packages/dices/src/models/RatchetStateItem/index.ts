import { RequiredProperties } from "@xkore/dice";
import { createGetFromKeyHandler } from "../../utilities/createGetHandler";
import { createIterateHandler } from "../../utilities/createIterateHandler";
import { createPutHandler } from "../../utilities/createPutHandler";
import type { Item } from "../Item";
import { RootChain } from "../RootChain";
import { RatchetStateItemKeyCodec, RatchetStateItemValueCodec, type RatchetStateItemKey, type RatchetStateItemValue } from "./Codec";
import { decryptRatchetStateMessage } from "./methods/decryptMessage";
import { encryptRatchetStateMessage } from "./methods/encryptMessage";
import { initializeRatchetStateAsInitiator } from "./methods/initializeAsInitiator";
import { initializeRatchetStateAsResponder } from "./methods/initializeAsResponder";
import { performRatchetStateDhRatchet } from "./methods/performDhRatchet";
import { performRatchetStateMlKemRatchet } from "./methods/performMlKemRatchet";
import { pruneRatchetStateSkippedKeys } from "./methods/pruneSkippedKeys";
import { shouldRatchetStateRatchet } from "./methods/shouldRatchet";
import { storeRatchetStateSkippedKey } from "./methods/storeSkippedKeys";
import { tryRatchetStateSkippedKey } from "./methods/trySkippedKey";

export namespace RatchetStateItem {
	export interface Properties extends RatchetStateItemKey, RatchetStateItemValue {}

	export interface Key extends Omit<RatchetStateItemKey, "indexKey"> {}
}

export class RatchetStateItem implements Item, RatchetStateItem.Properties {
	static shouldRatchet = shouldRatchetStateRatchet;

	static DEFAULT_MESSAGE_BOUND = 100;
	static DEFAULT_TIME_BOUND_MS = 60 * 60 * 1000; // 1 hour
	static INDEX_KEY = Uint8Array.from([0x01]);
	static SKIPPED_KEY_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

	static get = createGetFromKeyHandler(RatchetStateItemKeyCodec, RatchetStateItemValueCodec, (properties) => new RatchetStateItem(properties));
	static iterate = createIterateHandler(RatchetStateItemKeyCodec, RatchetStateItemValueCodec, (properties) => new RatchetStateItem(properties));
	static keyOf = (properties: RatchetStateItem.Key): Uint8Array => {
		return RatchetStateItemKeyCodec.encode({ indexKey: RatchetStateItem.INDEX_KEY, ...properties });
	};

	static initializeAsInitiator = initializeRatchetStateAsInitiator;
	static initializeAsResponder = initializeRatchetStateAsResponder;

	ratchetId: Uint8Array;
	remoteKeyId?: Uint8Array;
	rootChain: RootChain;
	previousChainLength: number;
	skippedKeys: Array<{
		messageNumber: number;
		secret: Uint8Array;
		createdAt: number;
	}>;
	ratchetAt: number;

	constructor(properties: RequiredProperties<RatchetStateItem.Properties, "ratchetId" | "rootChain" | "previousChainLength">) {
		this.ratchetId = properties.ratchetId;
		this.remoteKeyId = properties.remoteKeyId;
		this.rootChain = properties.rootChain;
		this.previousChainLength = properties.previousChainLength;
		this.skippedKeys = properties.skippedKeys || [];
		this.ratchetAt = properties.ratchetAt || Date.now();
	}

	get buffer(): Uint8Array {
		return RatchetStateItemValueCodec.encode(this);
	}

	get byteLength(): number {
		return RatchetStateItemValueCodec.byteLength(this);
	}

	get indexKey(): Uint8Array {
		return RatchetStateItem.INDEX_KEY;
	}

	get key(): Uint8Array {
		return RatchetStateItem.keyOf(this);
	}

	get properties(): RatchetStateItem.Properties {
		const { indexKey, ratchetId, remoteKeyId, rootChain, previousChainLength, skippedKeys, ratchetAt } = this;

		return {
			indexKey,
			ratchetId,
			remoteKeyId,
			rootChain,
			previousChainLength,
			skippedKeys,
			ratchetAt,
		};
	}

	decryptMessage = decryptRatchetStateMessage.bind(this, this);
	encryptMessage = encryptRatchetStateMessage.bind(this, this);
	performDhRatchet = performRatchetStateDhRatchet.bind(this, this);
	performMlKemRatchet = performRatchetStateMlKemRatchet.bind(this, this);
	pruneSkippedKeys = pruneRatchetStateSkippedKeys.bind(this, this);
	put = createPutHandler(this);
	shouldRatchet = shouldRatchetStateRatchet.bind(this, this);
	storeSkippedKeys = storeRatchetStateSkippedKey.bind(this, this);
	trySkippedKey = tryRatchetStateSkippedKey.bind(this, this);
}
