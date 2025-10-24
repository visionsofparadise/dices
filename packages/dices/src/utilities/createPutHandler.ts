import { Level } from "level";
import { Item } from "../models/Item";

export interface PutHandlerDependencies {
	database: Level<Uint8Array, Uint8Array>;
}

export const createPutHandler =
	<T extends Item>(item: T) =>
	async (dependencies: PutHandlerDependencies): Promise<void> => {
		const { database } = dependencies;

		await database.put(item.key, item.buffer);
	};
