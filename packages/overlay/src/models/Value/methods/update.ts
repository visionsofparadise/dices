import { compare } from "uint8array-tools";
import { Value } from "..";
import { Keys } from "../../Keys";

export const updateValue = (value: Value, properties: Partial<Omit<Value.Properties, "rSignature">>, keys: Keys): Value => {
	const updatedValue = new Value({
		...value.properties,
		...properties,
	});

	if (compare(value.hash, updatedValue.hash) === 0) return value;

	return Value.create(
		{
			initiationKeys: value.initiationKeys,
			signedAt: Date.now(),
			...properties,
		},
		keys
	);
};
