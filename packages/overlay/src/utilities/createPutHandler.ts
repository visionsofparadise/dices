import { Level } from "level";
import { Item } from "../models/Item";
import { retryDatabaseOperation } from "./retryDatabaseOperation";

export interface PutHandlerDependencies {
	database: Level<Uint8Array, Uint8Array>;
}

export const createPutHandler =
	<T extends Item>(item: T) =>
	async (dependencies: PutHandlerDependencies): Promise<void> => {
		const { database } = dependencies;

		await retryDatabaseOperation(() => database.put(item.key, item.buffer));
	};
