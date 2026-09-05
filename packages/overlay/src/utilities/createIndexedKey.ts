import { concat } from "uint8array-tools";

export const createIndexedKey = (indexKey: number, keys: Array<Uint8Array>) => {
	return concat([Uint8Array.from([indexKey]), ...keys]);
};
