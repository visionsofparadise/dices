import { AbstractCodec, BytesConstantCodec, Codec, ObjectCodec } from "bufferfy";
import { IteratorOptions, Level } from "level";
import { concat } from "uint8array-tools";
import { merge } from "./merge";

export enum IterateSortOrder {
	ASCENDING = "ascending",
	DESCENDING = "descending",
}

export interface IterateHandlerQuery extends IteratorOptions<Uint8Array, Uint8Array> {}

export interface IterateHandlerDependencies {
	signal?: AbortSignal;
	database: Level<Uint8Array, Uint8Array>;
}

export const createIterateHandler = <K extends { indexKey: BytesConstantCodec }, V, T>(
	KeyCodec: ObjectCodec<K>,
	ValueCodec: AbstractCodec<V>,
	transform: (properties: Codec.Type<typeof KeyCodec> & V) => T
) =>
	async function* (query: IterateHandlerQuery | undefined, dependencies: IterateHandlerDependencies): AsyncIterableIterator<T> {
		const { signal, database } = dependencies;

		const defaultQuery = { ...query };

		if (!defaultQuery.gt && !defaultQuery.gte) {
			defaultQuery.gte = concat([KeyCodec.properties.indexKey.bytes, Uint8Array.from([0x00])]);
		}

		if (!defaultQuery.lt && !defaultQuery.lte) {
			defaultQuery.lte = concat([KeyCodec.properties.indexKey.bytes, Uint8Array.from([0xff])]);
		}

		for await (const [key, value] of database.iterator(defaultQuery)) {
			if (signal?.aborted) break;

			yield transform(merge(KeyCodec.decode(key), ValueCodec.decode(value)));
		}
	};
