import { AbstractCodec, BytesConstantCodec, Codec, ObjectCodec } from "bufferfy";
import { Level } from "level";
import { merge } from "./merge";

export interface GetHandlerDependencies {
	database: Level<Uint8Array, Uint8Array>;
}

export const createGetFromKeyHandler =
	<K, V, T>(KeyCodec: AbstractCodec<K>, ValueCodec: AbstractCodec<V>, transform: (properties: K & V) => T) =>
	async (key: Uint8Array, dependencies: GetHandlerDependencies): Promise<T | undefined> => {
		const { database } = dependencies;

		let value: Uint8Array;

		try {
			value = await database.get(key);
		} catch (error: any) {
			if (error.code === 'LEVEL_NOT_FOUND' || error.notFound) {
				return undefined;
			}
			throw error;
		}

		if (!value) return undefined;

		return transform(merge(KeyCodec.decode(key), ValueCodec.decode(value)));
	};

export const createGetHandler =
	<K extends { indexKey: BytesConstantCodec }, V, T>(KeyCodec: ObjectCodec<K>, ValueCodec: AbstractCodec<V>, transform: (properties: Codec.Type<typeof KeyCodec> & V) => T) =>
	async (dependencies: GetHandlerDependencies): Promise<T | undefined> =>
		createGetFromKeyHandler(KeyCodec, ValueCodec, transform)(KeyCodec.properties.indexKey.bytes, dependencies);
