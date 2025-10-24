export const optionalTransform = <V, R>(value: V | undefined, transform: (value: V) => R): R | undefined => {
	if (typeof value !== "undefined") return transform(value);
	return undefined;
};
