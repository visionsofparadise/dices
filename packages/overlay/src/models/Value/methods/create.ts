import { RequiredProperties } from "@xkore/dice";
import { Value } from "..";
import { Keys } from "../../Keys";

export const createValue = (properties: RequiredProperties<Value.Properties, "initiationKeys">, keys: Keys): Value => {
	const defaultProperties: Omit<Value.Properties, "rSignature"> = {
		initiationKeys: properties.initiationKeys,
		signedAt: properties.signedAt || Date.now(),
	};

	const hash = Value.hash(defaultProperties);

	const rSignature = keys.rSign(hash);

	const value = new Value(
		{
			...defaultProperties,
			rSignature,
		},
		{
			hash,
			nodeId: keys.nodeId,
			nodeIdCheck: keys.nodeIdCheck,
			publicKey: keys.publicKey,
		}
	);

	return value;
};
