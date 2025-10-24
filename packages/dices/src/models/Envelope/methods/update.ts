import { compare } from "uint8array-tools";
import type { Envelope } from "..";
import { Envelope as EnvelopeClass } from "..";
import type { Keys } from "../../Keys";

export const updateEnvelope = (
	envelope: EnvelopeClass,
	properties: Partial<Omit<Envelope.Properties, "rSignature">>,
	keys: Keys
): EnvelopeClass => {
	const updatedEnvelope = new EnvelopeClass({
		...envelope.properties,
		...properties,
	});

	if (compare(envelope.hash, updatedEnvelope.hash) === 0) return envelope;

	return EnvelopeClass.create(
		{
			magicBytes: envelope.magicBytes,
			version: envelope.version,
			keyId: envelope.keyId,
			dhPublicKey: envelope.dhPublicKey,
			messageNumber: envelope.messageNumber,
			previousChainLength: envelope.previousChainLength,
			kemCiphertext: envelope.kemCiphertext,
			cipherData: envelope.cipherData,
			...properties,
		},
		keys
	);
};
