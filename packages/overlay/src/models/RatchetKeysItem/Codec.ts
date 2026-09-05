import { Codec } from "bufferfy";
import { RatchetKeysItem } from ".";
import { KeyIdCodec } from "./KeyIdCodec";
import { MlKemSeedCodec } from "./MlKemCodec";
import { X25519SecretKeyCodec } from "./X25519Codec";

export const RatchetKeysItemKeyCodec = Codec.Object({
	indexKey: Codec.Bytes(Uint8Array.from([0x00])),
	keyId: KeyIdCodec,
});

export type RatchetKeysItemKey = Codec.Type<typeof RatchetKeysItemKeyCodec>;

export const RatchetKeysItemValueCodec = Codec.Object({
	mlKemSeed: MlKemSeedCodec,
	dhSecretKey: X25519SecretKeyCodec,
	rotatedAt: Codec.Optional(Codec.VarInt(60)),
});

export type RatchetKeysItemValue = Codec.Type<typeof RatchetKeysItemValueCodec>;

export const RatchetKeysItemCodec = Codec.Transform(
	Codec.Object({
		key: RatchetKeysItemKeyCodec,
		value: RatchetKeysItemValueCodec,
	}),
	{
		decode: ({ key, value }) =>
			new RatchetKeysItem({
				...key,
				...value,
			}),
		encode: (ratchetKeys) => ({
			key: ratchetKeys,
			value: ratchetKeys,
		}),
	}
);
