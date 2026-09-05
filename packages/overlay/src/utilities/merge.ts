import { mergeWith } from "lodash-es";

export const merge = <S, T>(object: S, source: T): S & T =>
	mergeWith(object, source, (objectValue, _) => {
		if (objectValue instanceof Uint8Array) return objectValue;
	});
